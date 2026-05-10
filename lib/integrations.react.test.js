import { describe, it, expect, vi, beforeEach } from 'vitest'
import fc from 'fast-check'

let effectCallbacks = []
let effectCleanups = []
let useRefCalls = []

vi.mock('react', () => {
  return {
    useRef: (initial) => {
      const ref = { current: initial }
      useRefCalls.push(ref)
      return ref
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
    useRefCalls = []
  })

  it('exports useWccEvent as a named function', () => {
    expect(typeof useWccEvent).toBe('function')
  })

  // Form 1: useWccEvent(ref, eventName, handler) — uses existing ref
  it('Form 1: accepts an existing ref and attaches listener', () => {
    const el = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    }
    const existingRef = { current: el }

    useWccEvent(existingRef, 'change', () => {})

    expect(el.addEventListener).toHaveBeenCalledWith('change', expect.any(Function))
  })

  it('Form 1: does not return a ref (void)', () => {
    const existingRef = { current: null }
    const result = useWccEvent(existingRef, 'change', () => {})
    expect(result).toBeUndefined()
  })

  // Form 2: useWccEvent(eventName, handler) — creates ref
  it('Form 2: returns a ref object when called with (eventName, handler)', () => {
    const ref = useWccEvent('change', () => {})
    expect(ref).toHaveProperty('current')
  })

  it('calls removeEventListener on cleanup', () => {
    const el = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    }
    const existingRef = { current: el }

    useWccEvent(existingRef, 'custom-event', () => {})

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
    const existingRef = { current: el }

    useWccEvent(existingRef, 'change', handler1)

    // Get the listener that was attached
    const listener = el.addEventListener.mock.calls[0][1]

    // The hook stores handler in a ref via useRef — find the handlerRef
    // useRefCalls[0] is the handlerRef created by the hook
    const handlerRef = useRefCalls[0]
    handlerRef.current = handler2

    // Dispatch event - should call the latest handler via handlerRef
    listener({ type: 'change', detail: 'test' })

    expect(handler2).toHaveBeenCalled()
    expect(handler1).not.toHaveBeenCalled()
  })

  describe('Property 2: Event listener lifecycle (attach and cleanup)', () => {
    it('addEventListener and removeEventListener are called for any event name', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0),
          (eventName) => {
            effectCallbacks = []
            effectCleanups = []
            useRefCalls = []

            const el = {
              addEventListener: vi.fn(),
              removeEventListener: vi.fn()
            }
            const existingRef = { current: el }

            useWccEvent(existingRef, eventName, () => {})

            if (el.addEventListener.mock.calls.length === 0) return false
            if (el.addEventListener.mock.calls[0][0] !== eventName) return false

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
    it('handler is invoked with dispatched event for any event name and detail', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0),
          fc.jsonValue(),
          (eventName, detail) => {
            effectCallbacks = []
            effectCleanups = []
            useRefCalls = []

            const handler = vi.fn()

            let capturedListener = null
            const el = {
              addEventListener: vi.fn((name, fn) => { capturedListener = fn }),
              removeEventListener: vi.fn()
            }
            const existingRef = { current: el }

            useWccEvent(existingRef, eventName, handler)

            // Update handlerRef to point to our handler
            if (useRefCalls.length > 0) useRefCalls[0].current = handler

            if (!capturedListener) return false
            const event = { type: eventName, detail }
            capturedListener(event)

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
