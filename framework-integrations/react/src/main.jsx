import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'

// Register WCC components
import './wcc-components/wcc-counter.js'
import './wcc-components/wcc-card.js'
import './wcc-components/wcc-list.js'

createRoot(document.getElementById('root')).render(<App />)
