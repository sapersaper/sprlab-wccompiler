import React, { useState } from 'react'

export default function CompositionView() {
  return (
    <div>
      {/* WCC→WCC simple: wrapper > counter */}
      <h2>Test 16: WCC→WCC simple (wrapper > counter)</h2>
      <WrapperCounterTest />

      {/* 2 niveles: wrapper > card */}
      <h2>Test 17: 2 niveles (wrapper > card)</h2>
      <WrapperCardTest />

      {/* wcc-parent con wcc-counter interno */}
      <h2>Test 18: wcc-parent with internal wcc-counter</h2>
      <ParentTest />

      {/* each con wcc-counter por item */}
      <h2>Test 19: each con wcc-counter por item</h2>
      <EachTest />
    </div>
  )
}

function WrapperCounterTest() {
  const [count] = useState(5)
  return (
    <wcc-wrapper id="test16" title="Wrapper Title">
      <wcc-counter count={count} label="Inner"></wcc-counter>
    </wcc-wrapper>
  )
}

function WrapperCardTest() {
  return (
    <wcc-wrapper id="test17" title="Card Wrapper">
      <wcc-card>
        <div slot="header">Nested Card</div>
        <p>Body inside wrapper</p>
      </wcc-card>
    </wcc-wrapper>
  )
}

function ParentTest() {
  const [changed, setChanged] = useState(null)
  return (
    <div>
      <wcc-parent id="test18" initial-count={3} label="Parent"
        oncountchanged={(e) => setChanged(e.detail)}
      ></wcc-parent>
      <p>React parentChanged: {changed}</p>
    </div>
  )
}

function EachTest() {
  const items = [1, 2, 3]
  return (
    <div id="test19-area">
      {items.map((item, i) => (
        <wcc-wrapper key={i} title={'Item ' + item}>
          <wcc-counter count={item} label={'#' + i}></wcc-counter>
        </wcc-wrapper>
      ))}
    </div>
  )
}
