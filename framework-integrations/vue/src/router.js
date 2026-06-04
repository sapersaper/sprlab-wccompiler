import { createRouter, createWebHashHistory } from 'vue-router'
import BasicsView from './views/BasicsView.vue'
import DirectivesView from './views/DirectivesView.vue'
import CompositionView from './views/CompositionView.vue'

export default createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: '/basics' },
    { path: '/basics', name: 'basics', component: BasicsView },
    { path: '/directives', name: 'directives', component: DirectivesView },
    { path: '/composition', name: 'composition', component: CompositionView },
  ],
})
