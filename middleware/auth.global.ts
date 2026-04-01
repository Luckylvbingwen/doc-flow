/**
 * 全局路由鉴权中间件
 * - SSR 阶段：通过 cookie 标记判断登录态，确保服务端渲染正确布局
 * - 客户端：通过 localStorage 中的完整 token 判断
 * - 未登录或 token 过期 → 跳转 /login
 * - 登录页已认证 → 跳转 /docs
 */
export default defineNuxtRouteMiddleware((to) => {
	const isLoginPage = to.path === '/login'

	// SSR 阶段：读 cookie 判断登录态，保证渲染正确的布局
	if (import.meta.server) {
		const authFlag = useCookie('docflow_auth_flag')
		if (isLoginPage && authFlag.value) {
			return navigateTo('/docs')
		}
		if (!isLoginPage && !authFlag.value) {
			return navigateTo('/login')
		}
		return
	}

	// 客户端：完整鉴权检查
	const authStore = useAuthStore()
	authStore.hydrateSession()

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
