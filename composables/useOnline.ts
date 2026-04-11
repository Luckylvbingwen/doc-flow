/**
 * 网络状态监测
 * 返回响应式的 isOnline，离线/上线时自动更新
 */
export function useOnline() {
	const isOnline = ref(true)

	const update = () => {
		isOnline.value = navigator.onLine
	}

	onMounted(() => {
		update()
		window.addEventListener('online', update)
		window.addEventListener('offline', update)
	})

	onBeforeUnmount(() => {
		window.removeEventListener('online', update)
		window.removeEventListener('offline', update)
	})

	return { isOnline }
}
