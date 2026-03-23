import { defineStore } from 'pinia'

export const useAppStore = defineStore('app', {
  state: () => ({
    workspaceReady: true,
    latestPingAt: ''
  }),
  actions: {
    markPinged() {
      this.latestPingAt = new Date().toISOString()
    }
  }
})
