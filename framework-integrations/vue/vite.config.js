import { defineConfig } from 'vite'
import { wccVuePlugin } from './src/wcc-components/vue-plugin.js'

export default defineConfig({
  plugins: [wccVuePlugin({ prefix: 'wcc-' })],
  server: { port: 4001 },
})
