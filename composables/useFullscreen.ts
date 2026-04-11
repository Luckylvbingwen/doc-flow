/**
 * 全屏切换
 * @param target 目标元素 ref，默认 document.documentElement
 */
export function useFullscreen(target?: Ref<HTMLElement | null>) {
	const isFullscreen = ref(false)

	function getEl(): HTMLElement {
		return target?.value ?? document.documentElement
	}

	async function enter() {
		try {
			await getEl().requestFullscreen()
		} catch {
			// 浏览器不支持或用户拒绝
		}
	}

	async function exit() {
		try {
			if (document.fullscreenElement) {
				await document.exitFullscreen()
			}
		} catch {
			// ignore
		}
	}

	async function toggle() {
		if (isFullscreen.value) {
			await exit()
		} else {
			await enter()
		}
	}

	const onFullscreenChange = () => {
		isFullscreen.value = !!document.fullscreenElement
	}

	onMounted(() => {
		document.addEventListener('fullscreenchange', onFullscreenChange)
	})

	onBeforeUnmount(() => {
		document.removeEventListener('fullscreenchange', onFullscreenChange)
	})

	return { isFullscreen, toggle, enter, exit }
}
