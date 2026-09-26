import { createRouter, createWebHashHistory } from 'vue-router'
import LibraryView from './views/LibraryView.vue'
import WorkspaceView from './views/WorkspaceView.vue'

export default createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'library', component: LibraryView },
    { path: '/book/:id', name: 'workspace', component: WorkspaceView, props: true }
  ]
})
