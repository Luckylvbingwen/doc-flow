/**
 * usePageLoading — 页面级全屏遮罩 loading
 *
 * 用于页面初始化加载数据（列表、卡片等）时显示全屏遮罩层。
 * 配合模板中 v-loading.fullscreen.lock="pageLoading" 使用。
 *
 * 用法 A — 页面直接调用接口：
 *   const { pageLoading, run } = usePageLoading()
 *   onMounted(() => run(() => fetchList()))
 *   // 模板: <section v-loading.fullscreen.lock="pageLoading">
 *
 * 用法 B — 等待子组件首次加载完成：
 *   const { pageLoading, waitUntil } = usePageLoading(true)
 *   // childLoading 是子组件暴露的 loading 状态
 *   waitUntil(() => childRef.value != null && !childRef.value.loading)
 *   // 模板: <section v-loading.fullscreen.lock="pageLoading">
 */
export function usePageLoading(initialState = false) {
	const pageLoading = ref(initialState)

	async function run<T>(fn: () => Promise<T>): Promise<T | undefined> {
		if (pageLoading.value) return
		pageLoading.value = true
		try {
			return await fn()
		} finally {
			pageLoading.value = false
		}
	}

	/**
	 * 等待条件满足后关闭 loading（用于子组件委托加载场景）
	 */
	function waitUntil(condFn: () => boolean) {
		if (condFn()) {
			pageLoading.value = false
			return
		}
		const stop = watch(condFn, (met) => {
			if (met) {
				pageLoading.value = false
				stop()
			}
		})
	}

	return { pageLoading, run, waitUntil }
}
