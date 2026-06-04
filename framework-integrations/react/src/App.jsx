import React from 'react'
import { HashRouter, Routes, Route, Navigate, NavLink } from 'react-router-dom'
import BasicsView from './views/BasicsView.jsx'
import DirectivesView from './views/DirectivesView.jsx'
import CompositionView from './views/CompositionView.jsx'

export default function App() {
  return (
    <HashRouter>
      <div>
        <h1>WCC React Integration Tests</h1>

        <nav>
          <NavLink to="/basics">Basics</NavLink> |
          <NavLink to="/directives">Directives</NavLink> |
          <NavLink to="/composition">Composition</NavLink>
        </nav>

        <hr />

        <Routes>
          <Route path="/" element={<Navigate to="/basics" replace />} />
          <Route path="/basics" element={<BasicsView />} />
          <Route path="/directives" element={<DirectivesView />} />
          <Route path="/composition" element={<CompositionView />} />
        </Routes>
      </div>
    </HashRouter>
  )
}
