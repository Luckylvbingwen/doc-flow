/**
 * v-auth 指令 + 权限自动加载
 *
 * 指令用法：
 *   <el-button v-auth="'role:create'">新增</el-button>
 *   <el-button v-auth="['role:create', 'role:update']">编辑</el-button>       ← OR
 *   <el-button v-auth.all="['doc:create', 'doc:update']">高级</el-button>     ← AND
 */
import type { DirectiveBinding, ObjectDirective } from 'vue'
import { watchEffect } from 'vue'

// 存储每个元素的 watchEffect 清理函数
const cleanupMap = new WeakMap<HTMLElement, () => void>()

export default defineNuxtPlugin(async (nuxtApp) => {
	const authDirective: ObjectDirective<HTMLElement, string | string[]> = {
		mounted(el, binding) {
			setupReactiveCheck(el, binding)
		},
		updated(el, binding) {
			// binding 值变化时重建 watcher
			teardown(el)
			setupReactiveCheck(el, binding)
		},
		beforeUnmount(el) {
			teardown(el)
		},
		getSSRProps() {
			return {}
		}
	}

	nuxtApp.vueApp.directive('auth', authDirective)

	// ── 客户端：登录态下等待权限加载完毕再渲染 ──
	if (import.meta.client) {
		const authStore = useAuthStore()
		authStore.hydrateSession()
		if (authStore.isAuthenticated) {
			await authStore.fetchProfile().catch(() => {})
		}
	}
})

/** 为元素建立响应式权限监听 */
function setupReactiveCheck(el: HTMLElement, binding: DirectiveBinding<string | string[]>) {
	const { value, modifiers } = binding
	if (!value) return

	const codes = Array.isArray(value) ? value : [value]
	const mode = modifiers.all ? 'all' : 'any'

	const stop = watchEffect(() => {
		const authStore = useAuthStore()

		// super_admin 放行
		if (authStore.roles.some(r => r.code === 'super_admin')) {
			restoreElement(el)
			return
		}

		let has: boolean
		if (mode === 'all') {
			has = codes.every(p => authStore.permissions.includes(p))
		} else {
			has = codes.some(p => authStore.permissions.includes(p))
		}

		if (has) {
			restoreElement(el)
		} else {
			hideElement(el)
		}
	})

	cleanupMap.set(el, stop)
}

function teardown(el: HTMLElement) {
	const stop = cleanupMap.get(el)
	if (stop) {
		stop()
		cleanupMap.delete(el)
	}
}

function hideElement(el: HTMLElement) {
	if (!el.dataset.vAuthOriginalDisplay) {
		el.dataset.vAuthOriginalDisplay = el.style.display || ''
	}
	el.style.display = 'none'
}

function restoreElement(el: HTMLElement) {
	if (el.dataset.vAuthOriginalDisplay !== undefined) {
		el.style.display = el.dataset.vAuthOriginalDisplay
		delete el.dataset.vAuthOriginalDisplay
	}
}
