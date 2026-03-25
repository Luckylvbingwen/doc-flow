import { defineStore } from 'pinia'

const AUTH_STORAGE_KEY = 'docflow:auth:session'

interface AuthUser {
	id: number
	name: string
	email: string | null
	feishuOpenId: string
}

interface AuthSession {
	token: string
	tokenType: 'Bearer'
	expiresIn: number
	user: AuthUser
}

export const useAuthStore = defineStore('auth', {
	state: () => ({
		token: '',
		tokenType: 'Bearer' as 'Bearer',
		expiresAt: 0,
		user: null as AuthUser | null
	}),
	getters: {
		isAuthenticated: (state) => {
			if (!state.token || !state.expiresAt) {
				return false
			}

			return Date.now() < state.expiresAt
		}
	},
	actions: {
		setSession(session: AuthSession) {
			this.token = session.token
			this.tokenType = session.tokenType
			this.expiresAt = Date.now() + session.expiresIn * 1000
			this.user = session.user

			if (!import.meta.client) {
				return
			}

			window.localStorage.setItem(
				AUTH_STORAGE_KEY,
				JSON.stringify({
					token: this.token,
					tokenType: this.tokenType,
					expiresAt: this.expiresAt,
					user: this.user
				})
			)
		},
		clearSession() {
			this.token = ''
			this.tokenType = 'Bearer'
			this.expiresAt = 0
			this.user = null

			if (!import.meta.client) {
				return
			}

			window.localStorage.removeItem(AUTH_STORAGE_KEY)
		},
		hydrateSession() {
			if (!import.meta.client) {
				return
			}

			const raw = window.localStorage.getItem(AUTH_STORAGE_KEY)
			if (!raw) {
				return
			}

			try {
				const parsed = JSON.parse(raw) as {
					token?: string
					tokenType?: 'Bearer'
					expiresAt?: number
					user?: AuthUser | null
				}

				this.token = parsed.token || ''
				this.tokenType = parsed.tokenType || 'Bearer'
				this.expiresAt = parsed.expiresAt || 0
				this.user = parsed.user || null

				if (!this.isAuthenticated) {
					this.clearSession()
				}
			} catch {
				this.clearSession()
			}
		}
	}
})
