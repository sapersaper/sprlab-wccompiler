import React, { useState } from 'react'

export default function BasicsView() {
  return (
    <div>
      {/* PROPS */}
      <h2>Test 1: Props (count, label)</h2>
      <PropsTest />

      {/* EVENTS */}
      <h2>Test 2: Events (onCountChanged)</h2>
      <EventsTest />

      {/* TWO-WAY BINDING */}
      <h2>Test 3: Two-way binding</h2>
      <p><em>No aplica en React — se resuelve con prop + event (Test 2).</em></p>

      <h2>Test 4: Two-way binding (modifier / multiple)</h2>
      <p><em>No aplica en React.</em></p>

      {/* DEFAULT SLOT */}
      <h2>Test 5: Default slot (children)</h2>
      <wcc-card id="test5">
        <p>Body content via default slot</p>
      </wcc-card>

      {/* NAMED SLOTS */}
      <h2>Test 6: Named slots (JSX prop)</h2>
      <wcc-card id="test6"
        header={<strong>Header via JSX prop</strong>}
        footer={<span>Footer via JSX prop</span>}
      >
        <p>Body content</p>
      </wcc-card>

      <h2>Test 7: Named slots — nested elements (JSX prop)</h2>
      <wcc-card id="test7"
        header={<strong>Bold</strong>}
        footer={<a href="#">link</a>}
      >
        <p>Body content</p>
      </wcc-card>

      <h2>Test 8: Named slot — complex content (JSX prop)</h2>
      <wcc-card id="test8"
        header={<button onClick={() => alert('test')}>Click me</button>}
      >
        <p>Body content</p>
      </wcc-card>

      {/* SCOPED SLOTS */}
      <h2>Test 9: Scoped slot (render prop — item + index)</h2>
      <wcc-list id="test9"
        renderItem={(item, index) => <li><strong>{index}</strong>: {item}</li>}
      />

      <h2>Test 10: Scoped slot (render prop — custom class)</h2>
      <wcc-list id="test10"
        renderItem={(item) => <li className="custom">★ {item}</li>}
      />

      <h2>Test 11: Scoped slot + React state coexistence</h2>
      <ScopedWithStateTest />
    </div>
  )
}

function PropsTest() {
  const [propCount] = useState(10)
  return (
    <div>
      <wcc-counter id="test1" count={propCount} label="Static Label" />
      <p>React propCount: {propCount}</p>
    </div>
  )
}

function EventsTest() {
  const [eventCount, setEventCount] = useState(0)
  return (
    <div>
      <wcc-counter id="test2" count={eventCount} onCountChanged={setEventCount} />
      <p>React eventCount: {eventCount}</p>
      <button onClick={() => setEventCount(c => c + 1)}>React increment (manual)</button>
    </div>
  )
}

function ScopedWithStateTest() {
  const [reactMessage] = useState('hello from React!')
  return (
    <wcc-list id="test11"
      renderItem={(item) => <li>{item} (React says: {reactMessage})</li>}
    />
  )
}
