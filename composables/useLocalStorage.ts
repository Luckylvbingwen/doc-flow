/**
 * 响应式 localStorage
 * @param key 存储键名
 * @param defaultValue 默认值
 */
export function useLocalStorage<T>(key: string, defaultValue: T): Ref<T> {
	const data = ref(defaultValue) as Ref<T>

	// 读取初始值
	if (import.meta.client) {
		try {
			const raw = localStorage.getItem(key)
			if (raw !== null) {
				data.value = JSON.parse(raw)
			}
		} catch {
			// 解析失败用默认值
		}
	}

	// 写入时同步到 localStorage
	watch(data, (val) => {
		if (import.meta.client) {
			try {
				localStorage.setItem(key, JSON.stringify(val))
			} catch {
				// 存储满或无权限
			}
		}
	}, { deep: true })

	return data
}
