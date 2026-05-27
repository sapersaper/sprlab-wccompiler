import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { wccReactPlugin, wccReactComponents } from './src/wcc-components/react-plugin.js'

export default defineConfig({
  plugins: [
    wccReactComponents({ componentsDir: './src', prefix: 'wcc-' }),
    wccReactPlugin({ prefix: 'wcc-' }),
    react()
  ],
  server: {
    port: 4002,
  },
})
