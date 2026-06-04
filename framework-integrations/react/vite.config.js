import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { wccReactPlugin } from './src/wcc-components/react-plugin.js'

export default defineConfig({
  plugins: [
    wccReactPlugin({ prefix: 'wcc-' }),
    react()
  ],
  server: { port: 4002 },
})
