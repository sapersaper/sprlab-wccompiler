import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { wccReactPlugin, wccReactComponents } from '@sprlab/wccompiler/integrations/react'

export default defineConfig({
  plugins: [
    wccReactComponents({ componentsDir: './src', prefix: 'wcc-' }),
    wccReactPlugin({ prefix: 'wcc-' }),
    react()
  ]
})
