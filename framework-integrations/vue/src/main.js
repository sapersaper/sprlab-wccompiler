import { createApp } from 'vue'
import App from './App.vue'
import router from './router.js'
import './wcc-components/basics/wcc-counter.js'
import './wcc-components/basics/wcc-card.js'
import './wcc-components/basics/wcc-list.js'
import './wcc-components/directives/wcc-conditional.js'
import './wcc-components/directives/wcc-toggle.js'
import './wcc-components/directives/wcc-input.js'
import './wcc-components/directives/wcc-styled.js'
import './wcc-components/composition/wcc-wrapper.js'
import './wcc-components/composition/wcc-parent.js'

const app = createApp(App)
app.use(router)
app.mount('#app')
