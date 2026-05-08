import React, { useRef, useState } from 'react'

export default function App() {
  const [message] = useState('hello from React!')

  return (
    <div>
      <h1>WCC React Integration Tests</h1>

      {/* Test 1: Named slot via string prop */}
      <h2>Test 1: Named slot (string prop)</h2>
      <wcc-card id="test1" header="Simple Header" footer="Simple Footer">
        <p>Body content via children</p>
      </wcc-card>

      {/* Test 2: Named slot via JSX prop */}
      <h2>Test 2: Named slot (JSX prop)</h2>
      <wcc-card id="test2"
        header={<h3>Header via JSX prop</h3>}
        footer={<span>Footer via JSX prop</span>}
      >
        <p>Body content 2</p>
      </wcc-card>

      {/* Test 3: Multiple named slots with nested elements */}
      <h2>Test 3: Named slots with nested elements</h2>
      <wcc-card id="test3"
        header={<div><strong>Bold</strong> header with <em>emphasis</em></div>}
        footer={<div>Footer with <a href="#">link</a></div>}
      >
        <p>Body 3</p>
      </wcc-card>

      {/* Test 4: Scoped slot (render prop) — single parameter */}
      <h2>Test 4: Scoped slot (single param)</h2>
      <wcc-list id="test4"
        renderItem={(item) => <li><strong>{item}</strong></li>}
      />

      {/* Test 5: Scoped slot (render prop) — multiple parameters */}
      <h2>Test 5: Scoped slot (multiple params)</h2>
      <wcc-list id="test5"
        renderItem={(item, index) => <li>{index}: {item}</li>}
      />

      {/* Test 6: Scoped slot with attributes */}
      <h2>Test 6: Scoped slot with class attribute</h2>
      <wcc-list id="test6"
        renderItem={(item) => <li className="custom-item">★ {item}</li>}
      />

      {/* Test 7: Passthrough props coexist with slot props */}
      <h2>Test 7: Passthrough props + slot props</h2>
      <wcc-card id="test7"
        data-testid="my-card"
        aria-label="Card component"
        header={<h3>Header 7</h3>}
      >
        <p>Body with passthrough props</p>
      </wcc-card>

      {/* Test 8: Event handlers preserved alongside slot props */}
      <h2>Test 8: Event handlers + slot props</h2>
      <wcc-card id="test8"
        onClick={() => console.log('clicked!')}
        header={<h3>Clickable Card</h3>}
      >
        <p>Click me (check console)</p>
      </wcc-card>

      {/* Test 9: ref preserved alongside slot props */}
      <h2>Test 9: ref + slot props</h2>
      <RefTest />
    </div>
  )
}

function RefTest() {
  const cardRef = useRef(null)

  return (
    <wcc-card id="test9"
      ref={cardRef}
      header={<h3>Card with ref</h3>}
    >
      <p>ref is preserved on the element</p>
    </wcc-card>
  )
}
