import React, { useState } from 'react'

export default function DirectivesView() {
  return (
    <div>
      {/* CONDITIONAL */}
      <h2>Test 12: Conditional (if/else-if/else)</h2>
      <ConditionalTest />

      {/* SHOW */}
      <h2>Test 13: Show directive</h2>
      <ShowTest />

      {/* INPUT */}
      <h2>Test 14: Input (prop + event)</h2>
      <InputTest />

      {/* STYLED */}
      <h2>Test 15: Styled (:class / :style)</h2>
      <StyledTest />
    </div>
  )
}

function ConditionalTest() {
  const [visible, setVisible] = useState(true)
  return (
    <div>
      <wcc-conditional id="test12" visible={visible}></wcc-conditional>
      <p>React visible: {String(visible)}</p>
      <button onClick={() => setVisible(v => !v)}>Toggle conditional</button>
    </div>
  )
}

function ShowTest() {
  const [show, setShow] = useState(true)
  return (
    <div>
      <wcc-toggle id="test13" show={show}></wcc-toggle>
      <p>React show: {String(show)}</p>
      <button onClick={() => setShow(v => !v)}>Toggle show</button>
    </div>
  )
}

function InputTest() {
  const [value, setValue] = useState('')
  return (
    <div>
      <wcc-input id="test14"
        placeholder="Type something..."
        value={value}
        onValueChanged={(e) => setValue(e.detail)}
      ></wcc-input>
      <p>React value: {value}</p>
    </div>
  )
}

function StyledTest() {
  const [variant, setVariant] = useState('primary')
  const [color, setColor] = useState('#333')
  return (
    <div>
      <wcc-styled id="test15" variant={variant} color={color}></wcc-styled>
      <p>React variant: {variant}, color: {color}</p>
      <button onClick={() => setVariant(v => v === 'primary' ? 'secondary' : 'primary')}>Toggle variant</button>
      <button onClick={() => setColor(c => c === '#333' ? '#e63946' : '#333')}>Toggle color</button>
    </div>
  )
}
