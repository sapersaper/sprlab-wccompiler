import { describe, it, expect, vi, beforeEach } from 'vitest'
import fc from 'fast-check'

// Track useRef and useEffect calls
let useRefCalls = []
let useEffectCalls = []

vi.mock('react', () => {
  return {
    useRef: (initial) => {
      const ref = { current: initial }
      useRefCalls.push(ref)
      return ref
    },
    useEffect: (fn, deps) => {
      useEffectCalls.push({ fn, deps })
    }
  }
})

const { useWccEvent } = await import('../integrations/react.js')

describe('React Integration - useWccEvent', () => {
  beforeEach(() => {
    useRefCalls = []
    useEffectCalls = []
  })

  it('exports useWccEvent as a named function', () => {
    expect(typeof useWccEvent).toBe('function')
  })

  it('returns a ref object with current property', () => {
    const ref = useWccEvent('test-event', () => {})
    expect(ref).toHaveProperty('current')
    expect(ref.current).toBe(null)
  })

  it('handler ref update does not re-attach listener', () => {
    const handler1 = () => {}
    const handler2 = () => {}

    useRefCalls = []
    useEffectCalls = []

    useWccEvent('my-event', handler1)
    const firstEffectDeps = useEffectCalls[0].deps

    useRefCalls = []
    useEffectCalls = []

    useWccEvent('my-event', handler2)
    const secondEffectDeps = useEffectCalls[0].deps

    // The effect deps should be keyed on eventName only, not handler
    // Both calls use the same eventName so deps should be equivalent
    expect(firstEffectDeps).toEqual(secondEffectDeps)
  })

  describe('Property 2: Event listener lifecycle (attach and cleanup)', () => {
    /**
     * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**
     *
     * For any event name string, when useWccEvent(eventName, handler) is used
     * and the ref is attached to a DOM element, the hook SHALL call
     * addEventListener(eventName, ...) on mount, and SHALL call
     * removeEventListener(eventName, ...) on unmount, leaving zero leaked listeners.
     */
    it('addEventListener is called on mount and removeEventListener on cleanup for any event name', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          (eventName) => {
            useRefCalls = []
            useEffectCalls = []

            const handler = () => {}
            const ref = useWccEvent(eventName, handler)

            // Simulate attaching the ref to a DOM element
            const addedListeners = []
            const removedListeners = []
            const mockElement = {
              addEventListener: (name, fn) => addedListeners.push({ name, fn }),
              removeEventListener: (name, fn) => removedListeners.push({ name, fn })
            }
            ref.current = mockElement

            // Run the effect (simulating mount)
            const effect = useEffectCalls.find(e => e.deps && e.deps.includes(eventName))
            if (!effect) return false

            const cleanup = effect.fn()

            // Verify addEventListener was called with the correct event name
            if (addedListeners.length !== 1) return false
            if (addedListeners[0].name !== eventName) return false

            // Run cleanup (simulating unmount)
            if (typeof cleanup === 'function') {
              cleanup()
            }

            // Verify removeEventListener was called with the same event name and function
            if (removedListeners.length !== 1) return false
            if (removedListeners[0].name !== eventName) return false
            if (removedListeners[0].fn !== addedListeners[0].fn) return false

            return true
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe('Property 3: Event dispatch invokes handler', () => {
    /**
     * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**
     *
     * For any event name and for any event detail value, when the referenced
     * DOM element dispatches a CustomEvent with that name and detail, the
     * provided handler SHALL be invoked with an event object whose detail
     * matches the dispatched value.
     */
    it('handler is invoked with correct event detail for any event name and detail', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          fc.jsonValue(),
          (eventName, detail) => {
            useRefCalls = []
            useEffectCalls = []

            let receivedEvent = null
            const handler = (e) => { receivedEvent = e }
            const ref = useWccEvent(eventName, handler)

            // Simulate attaching the ref to a DOM element
            let registeredListener = null
            const mockElement = {
              addEventListener: (name, fn) => { registeredListener = fn },
              removeEventListener: () => {}
            }
            ref.current = mockElement

            // Run the effect (simulating mount)
            const effect = useEffectCalls.find(e => e.deps && e.deps.includes(eventName))
            if (!effect) return false

            effect.fn()

            // Simulate dispatching a CustomEvent
            const customEvent = { type: eventName, detail }
            registeredListener(customEvent)

            // Verify handler was called with the event containing correct detail
            if (receivedEvent === null) return false
            if (receivedEvent.detail !== detail) return false

            return true
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})
