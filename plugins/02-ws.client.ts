/**
 * WebSocket 自动连接插件（仅客户端）
 * 登录态就绪后自动建立 WS 连接
 */
export default defineNuxtPlugin(() => {
	const authStore = useAuthStore()

	// 首次加载：如果已登录则立即连接
	if (authStore.isAuthenticated) {
		wsConnect()
	}

	// 监听 token 变化，登录后连接 / 登出后断开
	watch(
		() => authStore.token,
		(newToken) => {
			if (newToken && authStore.isAuthenticated) {
				wsConnect()
			} else {
				wsDisconnect()
			}
		}
	)
})
