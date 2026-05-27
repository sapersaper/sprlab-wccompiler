import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'

// Register WCC components
import './wcc/wcc-counter.js'
import './wcc/wcc-card.js'
import './wcc/wcc-list.js'

createRoot(document.getElementById('root')).render(<App />)
