import { defineStore } from 'pinia'
import { apiGetProfile } from '~/api/auth'
import type { AuthUser, AuthSession, AuthRole } from '~/types/api'

const AUTH_STORAGE_KEY = 'docflow:auth:session'

export const useAuthStore = defineStore('auth', {
	state: () => ({
		token: '',
		refreshToken: '',
		tokenType: 'Bearer' as const,
		expiresAt: 0,
		refreshExpiresAt: 0,
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
			this.refreshToken = session.refreshToken
			this.tokenType = session.tokenType
			this.expiresAt = Date.now() + session.expiresIn * 1000
			this.refreshExpiresAt = Date.now() + session.refreshExpiresIn * 1000
			this.user = session.user

			if (!import.meta.client) {
				return
			}

			this._persistToStorage()
			// 同步 cookie 标记，让 SSR 能判断登录态
			this._syncAuthCookie(session.expiresIn)
		},
		clearSession() {
			this.token = ''
			this.refreshToken = ''
			this.tokenType = 'Bearer'
			this.expiresAt = 0
			this.refreshExpiresAt = 0
			this.user = null
			this.roles = []
			this.permissions = []

			if (!import.meta.client) {
				return
			}

			// wsDisconnect 由 plugins/02-ws.client.ts watch token 变化自动触发，此处不再直接调用
			window.localStorage.removeItem(AUTH_STORAGE_KEY)
			// 清除 cookie 标记
			document.cookie = 'docflow_auth_flag=; path=/; max-age=0; SameSite=Lax'
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
					refreshToken?: string
					tokenType?: 'Bearer'
					expiresAt?: number
					refreshExpiresAt?: number
					user?: AuthUser | null
					roles?: AuthRole[]
					permissions?: string[]
				}

				this.token = parsed.token || ''
				this.refreshToken = parsed.refreshToken || ''
				this.tokenType = parsed.tokenType || 'Bearer'
				this.expiresAt = parsed.expiresAt || 0
				this.refreshExpiresAt = parsed.refreshExpiresAt || 0
				this.user = parsed.user || null
				this.roles = parsed.roles || []
				this.permissions = parsed.permissions || []

				if (!this.isAuthenticated) {
					this.clearSession()
				} else {
					// 确保 cookie 标记与 localStorage 同步
					const remainingSec = Math.floor((this.expiresAt - Date.now()) / 1000)
					if (remainingSec > 0) {
						this._syncAuthCookie(remainingSec)
					}
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
		/** 设置 cookie 标记，让 SSR 中间件判断登录态（不含敏感信息） */
		_syncAuthCookie(maxAgeSec: number) {
			if (!import.meta.client) return
			document.cookie = `docflow_auth_flag=1; path=/; max-age=${Math.floor(maxAgeSec)}; SameSite=Lax`
		},
		/** 持久化完整会话到 localStorage */
		_persistToStorage() {
			if (!import.meta.client) return

			window.localStorage.setItem(
				AUTH_STORAGE_KEY,
				JSON.stringify({
					token: this.token,
					refreshToken: this.refreshToken,
					tokenType: this.tokenType,
					expiresAt: this.expiresAt,
					refreshExpiresAt: this.refreshExpiresAt,
					user: this.user,
					roles: this.roles,
					permissions: this.permissions
				})
			)
		}
	}
})
