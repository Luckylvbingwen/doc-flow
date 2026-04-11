/**
 * 倒计时工具
 * @param seconds 倒计时总秒数
 */
export function useCountdown(seconds: number) {
	const remaining = ref(0)
	const isActive = computed(() => remaining.value > 0)
	let timer: ReturnType<typeof setInterval> | null = null

	function clear() {
		if (timer) {
			clearInterval(timer)
			timer = null
		}
	}

	function start() {
		clear()
		remaining.value = seconds
		timer = setInterval(() => {
			remaining.value--
			if (remaining.value <= 0) clear()
		}, 1000)
	}

	function reset() {
		clear()
		remaining.value = 0
	}

	onBeforeUnmount(clear)

	return { remaining, isActive, start, reset }
}
