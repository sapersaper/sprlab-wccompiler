import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { wccReactPlugin } from './src/wccReactPlugin.js'

export default defineConfig({
  plugins: [
    wccReactPlugin({ prefix: 'wcc-' }),
    react()
  ]
})
