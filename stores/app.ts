import { defineStore } from 'pinia'

const SIDEBAR_COLLAPSE_KEY = 'docflow:prototype:sidebar-collapsed'
const DARK_MODE_KEY = 'docflow:dark-mode'
const LOCALE_KEY = 'docflow:locale'

export const useAppStore = defineStore('app', {
	state: () => ({
		workspaceReady: true,
		latestPingAt: '',
		sidebarCollapsed: false,
		darkMode: false,
		locale: 'zh-CN' as 'zh-CN' | 'en-US',
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
		},
		hydrateDarkMode() {
			if (!import.meta.client) return
			const stored = window.localStorage.getItem(DARK_MODE_KEY)
			if (stored !== null) {
				this.setDarkMode(stored === '1')
			} else {
				this.setDarkMode(window.matchMedia('(prefers-color-scheme: dark)').matches)
			}
		},
		setDarkMode(enabled: boolean) {
			this.darkMode = enabled
			if (!import.meta.client) return
			document.documentElement.classList.toggle('dark', enabled)
			window.localStorage.setItem(DARK_MODE_KEY, enabled ? '1' : '0')
		},
		toggleDarkMode() {
			this.setDarkMode(!this.darkMode)
		},
		hydrateLocale() {
			if (!import.meta.client) return
			const stored = window.localStorage.getItem(LOCALE_KEY) as 'zh-CN' | 'en-US' | null
			if (stored === 'zh-CN' || stored === 'en-US') {
				this.locale = stored
			}
		},
		setLocale(locale: 'zh-CN' | 'en-US') {
			this.locale = locale
			if (!import.meta.client) return
			window.localStorage.setItem(LOCALE_KEY, locale)
		},
	}
})
