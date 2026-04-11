/**
 * 数字跳动动画
 * @param target 目标数值（ref 或固定值）
 * @param duration 动画时长（ms），默认 600
 */
export function useCountUp(target: Ref<number> | number, duration = 600) {
	const current = ref(0)
	let raf = 0

	function animate(from: number, to: number) {
		cancelAnimationFrame(raf)
		if (duration <= 0) {
			current.value = to
			return
		}
		const start = performance.now()
		const step = (now: number) => {
			const progress = Math.min((now - start) / duration, 1)
			// ease-out cubic
			const ease = 1 - (1 - progress) ** 3
			current.value = Math.round(from + (to - from) * ease)
			if (progress < 1) {
				raf = requestAnimationFrame(step)
			}
		}
		raf = requestAnimationFrame(step)
	}

	if (isRef(target)) {
		watch(target, (val, old) => animate(old ?? 0, val), { immediate: true })
	} else {
		onMounted(() => animate(0, target))
	}

	onBeforeUnmount(() => cancelAnimationFrame(raf))

	return current
}
