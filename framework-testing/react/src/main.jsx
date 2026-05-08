import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'

// Register WCC components
import './wcc-card.js'
import './wcc-list.js'

createRoot(document.getElementById('root')).render(<App />)
