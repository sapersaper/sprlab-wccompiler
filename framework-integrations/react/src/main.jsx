import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'

// Register WCC components
import './wcc-components/basics/wcc-counter.js'
import './wcc-components/basics/wcc-card.js'
import './wcc-components/basics/wcc-list.js'
import './wcc-components/directives/wcc-conditional.js'
import './wcc-components/directives/wcc-toggle.js'
import './wcc-components/directives/wcc-input.js'
import './wcc-components/directives/wcc-styled.js'
import './wcc-components/composition/wcc-wrapper.js'
import './wcc-components/composition/wcc-parent.js'

createRoot(document.getElementById('root')).render(<App />)
