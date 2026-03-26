import { defineStore } from 'pinia'
import { apiGetProfile } from '~/api/auth'

const AUTH_STORAGE_KEY = 'docflow:auth:session'

interface AuthUser {
	id: number
	name: string
	email: string | null
	feishuOpenId: string
	avatar: string
}

interface AuthSession {
	token: string
	tokenType: 'Bearer'
	expiresIn: number
	user: AuthUser
}

interface AuthRole {
	id: number
	code: string
	name: string
}

export const useAuthStore = defineStore('auth', {
	state: () => ({
		token: '',
		tokenType: 'Bearer' as 'Bearer',
		expiresAt: 0,
		user: null as AuthUser | null,
		roles: [] as AuthRole[],
		permissions: [] as string[]
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

			this._persistToStorage()
		},
		clearSession() {
			this.token = ''
			this.tokenType = 'Bearer'
			this.expiresAt = 0
			this.user = null
			this.roles = []
			this.permissions = []

			if (!import.meta.client) {
				return
			}

			wsDisconnect()
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
					roles?: AuthRole[]
					permissions?: string[]
				}

				this.token = parsed.token || ''
				this.tokenType = parsed.tokenType || 'Bearer'
				this.expiresAt = parsed.expiresAt || 0
				this.user = parsed.user || null
				this.roles = parsed.roles || []
				this.permissions = parsed.permissions || []

				if (!this.isAuthenticated) {
					this.clearSession()
				}
			} catch {
				this.clearSession()
			}
		},
		/** 调用 /api/auth/me 刷新角色与权限 */
		async fetchProfile() {
			if (!this.isAuthenticated) return

			const res = await apiGetProfile(this.token, this.tokenType)

			if (res.success && res.data) {
				this.roles = res.data.roles
				this.permissions = res.data.permissions
				if (res.data.avatar && this.user) {
					this.user.avatar = res.data.avatar
				}
				this._persistToStorage()
			}
		},
		/** 持久化完整会话到 localStorage */
		_persistToStorage() {
			if (!import.meta.client) return

			window.localStorage.setItem(
				AUTH_STORAGE_KEY,
				JSON.stringify({
					token: this.token,
					tokenType: this.tokenType,
					expiresAt: this.expiresAt,
					user: this.user,
					roles: this.roles,
					permissions: this.permissions
				})
			)
		}
	}
})
