import React, { useState } from 'react'

export default function BasicsView() {
  return (
    <div>
      {/* PROPS */}
      <h2>Test 1: Props (count, label)</h2>
      <PropsTest />

      {/* EVENTS */}
      <h2>Test 2: Events (oncountchanged)</h2>
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
      <h2>Test 6: Named slots (slot="name")</h2>
      <wcc-card id="test6">
        <div slot="header"><strong>Header via slot attr</strong></div>
        <p>Body content</p>
        <span slot="footer">Footer via slot attr</span>
      </wcc-card>

      <h2>Test 7: Named slots (slot="name" — nested elements)</h2>
      <wcc-card id="test7">
        <div slot="header"><strong>Bold</strong> header with <em>emphasis</em></div>
        <p>Body content</p>
        <div slot="footer">Footer with <a href="#">link</a></div>
      </wcc-card>

      <h2>Test 8: Named slots (JSX prop — via React plugin)</h2>
      <wcc-card id="test8"
        header={<strong>Header via JSX prop</strong>}
        footer={<span>Footer via JSX prop</span>}
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
      <wcc-counter id="test1" count={propCount} label="Static Label"></wcc-counter>
      <p>React propCount: {propCount}</p>
    </div>
  )
}

function EventsTest() {
  const [eventCount, setEventCount] = useState(0)
  return (
    <div>
      <wcc-counter id="test2" count={eventCount} oncountchanged={(e) => setEventCount(e.detail)}></wcc-counter>
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
