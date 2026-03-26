/**
 * 全局路由鉴权中间件（仅客户端）
 * - Token 存于 localStorage，服务端无法访问，因此跳过 SSR
 * - 未登录或 token 过期 → 跳转 /login
 * - 登录页已认证 → 跳转 /docs
 */
export default defineNuxtRouteMiddleware((to) => {
	// SSR 阶段跳过鉴权检查，避免 hydration mismatch
	if (import.meta.server) {
		return
	}

	const authStore = useAuthStore()
	authStore.hydrateSession()

	const isLoginPage = to.path === '/login'
	const isAuthenticated = authStore.isAuthenticated

	// 已登录访问登录页 → 跳首页
	if (isLoginPage && isAuthenticated) {
		return navigateTo('/docs')
	}

	// 未登录访问受保护页面 → 跳登录页
	if (!isLoginPage && !isAuthenticated) {
		return navigateTo('/login')
	}
})
