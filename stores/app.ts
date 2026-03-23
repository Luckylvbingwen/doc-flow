import { defineStore } from 'pinia'

const SIDEBAR_COLLAPSE_KEY = 'docflow:prototype:sidebar-collapsed'

export const useAppStore = defineStore('app', {
  state: () => ({
    workspaceReady: true,
    latestPingAt: '',
    sidebarCollapsed: false
  }),
  actions: {
    markPinged() {
      this.latestPingAt = new Date().toISOString()
    },
    hydrateSidebarCollapsed() {
      if (!import.meta.client) {
        return
      }

      this.sidebarCollapsed = window.localStorage.getItem(SIDEBAR_COLLAPSE_KEY) === '1'
    },
    setSidebarCollapsed(collapsed: boolean) {
      this.sidebarCollapsed = collapsed

      if (!import.meta.client) {
        return
      }

      window.localStorage.setItem(SIDEBAR_COLLAPSE_KEY, collapsed ? '1' : '0')
    },
    toggleSidebarCollapsed() {
      this.setSidebarCollapsed(!this.sidebarCollapsed)
    }
  }
})
