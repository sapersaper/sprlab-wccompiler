import { describe, it, expect, vi, beforeEach } from 'vitest'
import fc from 'fast-check'

let effectCallbacks = []
let effectCleanups = []
let refCallCount = 0
let mockElement = null
let handlerHolder = { current: null }

vi.mock('react', () => {
  return {
    useRef: (initial) => {
      refCallCount++
      // First call is the element ref, second is handler ref
      if (refCallCount % 2 === 1) {
        return { current: mockElement }
      }
      return handlerHolder
    },
    useEffect: (fn, _deps) => {
      effectCallbacks.push(fn)
      const cleanup = fn()
      if (cleanup) effectCleanups.push(cleanup)
    }
  }
})

const { useWccEvent } = await import('../integrations/react.js')

describe('React Integration - useWccEvent', () => {
  beforeEach(() => {
    effectCallbacks = []
    effectCleanups = []
    refCallCount = 0
    mockElement = null
    handlerHolder = { current: null }
  })

  it('exports useWccEvent as a named function', () => {
    expect(typeof useWccEvent).toBe('function')
  })

  it('returns a ref object with current property', () => {
    const ref = useWccEvent('change', () => {})
    expect(ref).toHaveProperty('current')
  })

  it('does not add event listener when ref.current is null', () => {
    mockElement = null
    useWccEvent('change', () => {})
    // No error thrown, no listener added
    expect(effectCleanups).toHaveLength(0)
  })

  it('adds event listener when ref.current is a DOM element', () => {
    const el = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    }
    mockElement = el

    useWccEvent('change', () => {})

    expect(el.addEventListener).toHaveBeenCalledWith('change', expect.any(Function))
  })

  it('calls removeEventListener on cleanup', () => {
    const el = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    }
    mockElement = el

    useWccEvent('custom-event', () => {})

    expect(effectCleanups).toHaveLength(1)
    effectCleanups[0]()
    expect(el.removeEventListener).toHaveBeenCalledWith('custom-event', expect.any(Function))
  })

  it('handler ref pattern uses latest handler', () => {
    const handler1 = vi.fn()
    const handler2 = vi.fn()
    const el = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    }
    mockElement = el

    // First render
    useWccEvent('change', handler1)

    // Get the listener that was attached
    const listener = el.addEventListener.mock.calls[0][1]

    // Simulate handler update (handlerRef.current gets updated)
    handlerHolder.current = handler2

    // Dispatch event - should call the latest handler
    listener({ type: 'change', detail: 'test' })

    expect(handler2).toHaveBeenCalled()
    expect(handler1).not.toHaveBeenCalled()
  })

  describe('Property 2: Event listener lifecycle (attach and cleanup)', () => {
    /**
     * **Validates: Requirements 3.2, 3.3**
     *
     * For any event name, addEventListener is called on mount
     * and removeEventListener is called on unmount.
     */
    it('addEventListener and removeEventListener are called for any event name', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0),
          (eventName) => {
            // Reset state
            effectCallbacks = []
            effectCleanups = []
            refCallCount = 0
            handlerHolder = { current: () => {} }

            const el = {
              addEventListener: vi.fn(),
              removeEventListener: vi.fn()
            }
            mockElement = el

            useWccEvent(eventName, () => {})

            // Verify addEventListener was called with the event name
            if (el.addEventListener.mock.calls.length === 0) return false
            if (el.addEventListener.mock.calls[0][0] !== eventName) return false

            // Run cleanup and verify removeEventListener
            if (effectCleanups.length === 0) return false
            effectCleanups[0]()
            if (el.removeEventListener.mock.calls.length === 0) return false
            if (el.removeEventListener.mock.calls[0][0] !== eventName) return false

            return true
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe('Property 3: Event dispatch invokes handler', () => {
    /**
     * **Validates: Requirements 3.4**
     *
     * For any event name and detail value, when the element dispatches a CustomEvent,
     * the handler is invoked with the event.
     */
    it('handler is invoked with dispatched event for any event name and detail', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0),
          fc.jsonValue(),
          (eventName, detail) => {
            // Reset state
            effectCallbacks = []
            effectCleanups = []
            refCallCount = 0

            const handler = vi.fn()
            handlerHolder = { current: handler }

            let capturedListener = null
            const el = {
              addEventListener: vi.fn((name, fn) => { capturedListener = fn }),
              removeEventListener: vi.fn()
            }
            mockElement = el

            useWccEvent(eventName, handler)

            // Simulate event dispatch
            if (!capturedListener) return false
            const event = { type: eventName, detail }
            capturedListener(event)

            // Verify handler was called with the event
            if (handler.mock.calls.length === 0) return false
            if (handler.mock.calls[0][0] !== event) return false

            return true
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})
