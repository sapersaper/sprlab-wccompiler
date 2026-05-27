import React, { useRef, useState } from 'react'

export default function App() {
  return (
    <div>
      <h1>WCC React Integration Tests</h1>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* PROPS                                                              */}
      {/* ═══════════════════════════════════════════════════════════════════ */}

      <h2>Test 1: Props (count, label)</h2>
      <wcc-counter id="test1" count="10" label="Static Label"></wcc-counter>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* EVENTS                                                             */}
      {/* ═══════════════════════════════════════════════════════════════════ */}

      <h2>Test 2: Events (oncountchanged)</h2>
      <EventsTest />

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* DEFAULT SLOT                                                       */}
      {/* ═══════════════════════════════════════════════════════════════════ */}

      <h2>Test 3: Default slot (children)</h2>
      <wcc-card id="test3">
        <p>Body content via children</p>
      </wcc-card>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* NAMED SLOTS                                                       */}
      {/* ═══════════════════════════════════════════════════════════════════ */}

      <h2>Test 4: Named slot (string prop)</h2>
      <wcc-card id="test4" header="Simple Header" footer="Simple Footer">
        <p>Body content</p>
      </wcc-card>

      <h2>Test 5: Named slot (JSX prop)</h2>
      <wcc-card id="test5"
        header={<h3>Header via JSX prop</h3>}
        footer={<span>Footer via JSX prop</span>}
      >
        <p>Body content</p>
      </wcc-card>

      <h2>Test 6: Named slots with nested elements</h2>
      <wcc-card id="test6"
        header={<div><strong>Bold</strong> header with <em>emphasis</em></div>}
        footer={<div>Footer with <a href="#">link</a></div>}
      >
        <p>Body 6</p>
      </wcc-card>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* SCOPED SLOTS                                                       */}
      {/* ═══════════════════════════════════════════════════════════════════ */}

      <h2>Test 7: Scoped slot (single param)</h2>
      <wcc-list id="test7"
        renderItem={(item) => <li><strong>{item}</strong></li>}
      />

      <h2>Test 8: Scoped slot (multiple params)</h2>
      <wcc-list id="test8"
        renderItem={(item, index) => <li>{index}: {item}</li>}
      />

      <h2>Test 9: Scoped slot with class attribute</h2>
      <wcc-list id="test9"
        renderItem={(item) => <li className="custom-item">★ {item}</li>}
      />

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* MISC                                                               */}
      {/* ═══════════════════════════════════════════════════════════════════ */}

      <h2>Test 10: Passthrough props + slot props</h2>
      <wcc-card id="test10"
        data-testid="my-card"
        aria-label="Card component"
        header={<h3>Header 10</h3>}
      >
        <p>Body with passthrough props</p>
      </wcc-card>

      <h2>Test 11: Event handlers + slot props</h2>
      <wcc-card id="test11"
        onClick={() => console.log('clicked!')}
        header={<h3>Clickable Card</h3>}
      >
        <p>Click me (check console)</p>
      </wcc-card>

      <h2>Test 12: ref preserved</h2>
      <RefTest />
    </div>
  )
}

function EventsTest() {
  const [count, setCount] = useState(0)
  return (
    <div>
      <wcc-counter id="test2" count={count} oncountchanged={(e) => setCount(e.detail)}></wcc-counter>
      <p>React eventCount: {count}</p>
    </div>
  )
}

function RefTest() {
  const cardRef = useRef(null)

  return (
    <wcc-card id="test12"
      ref={cardRef}
      header={<h3>Card with ref</h3>}
    >
      <p>ref is preserved on the element</p>
    </wcc-card>
  )
}
