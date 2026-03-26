/**
 * useLoading — 包装异步操作，自动管理 loading 状态
 *
 * 用法：
 *   const { loading, run } = useLoading()
 *   await run(() => apiGetRoles())            // loading 自动 true → false
 *   <el-button :loading="loading">提交</el-button>
 *
 * 支持多个独立 loading：
 *   const { loading: saving, run: runSave } = useLoading()
 *   const { loading: deleting, run: runDelete } = useLoading()
 */
export function useLoading(initialState = false) {
	const loading = ref(initialState)

	async function run<T>(fn: () => Promise<T>): Promise<T | undefined> {
		if (loading.value) return
		loading.value = true
		try {
			return await fn()
		} finally {
			loading.value = false
		}
	}

	return { loading, run }
}
