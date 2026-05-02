<template>
	<div class="pf-app" :class="{ 'pf-app--topnav': isTopnav }">
		<!-- ═══════ 侧栏模式 ═══════ -->
		<aside v-show="!isTopnav" class="pf-sidebar" :class="{ collapsed: isSidebarCollapsed }">
			<div class="pf-brand">
				<div class="pf-brand-logo">
					<el-icon :size="20">
						<Document />
					</el-icon>
				</div>
				<span class="pf-brand-text">DocFlow</span>
				<button
class="pf-sidebar-toggle" type="button" :aria-label="isSidebarCollapsed ? '展开侧栏' : '收起侧栏'"
					@click="toggleSidebar">
					<el-icon :size="18">
						<Expand v-if="isSidebarCollapsed" />
						<Fold v-else />
					</el-icon>
				</button>
			</div>

			<el-scrollbar class="pf-nav-scrollbar">
				<ClientOnly>
					<nav class="pf-nav">
						<template v-for="group in menuGroups" :key="group.title ?? 'default'">
							<p v-if="group.title" class="pf-nav-title">{{ group.title }}</p>
							<el-tooltip
v-for="item in group.items" :key="item.to" :content="item.label" placement="right"
								:disabled="!isSidebarCollapsed" :show-after="300">
								<NuxtLink class="pf-nav-item" :class="{ active: isItemActive(item) }" :to="item.to">
									<el-icon class="pf-nav-icon">
										<component :is="item.icon" />
									</el-icon>
									<span class="pf-nav-label">{{ item.label }}</span>
								</NuxtLink>
							</el-tooltip>
						</template>
					</nav>
				</ClientOnly>
			</el-scrollbar>
		</aside>

		<!-- ═══════ 顶栏模式 — 顶部导航 ═══════ -->
		<header v-show="isTopnav" class="pf-topbar">
			<div class="pf-topbar-left">
				<div class="pf-brand-logo">
					<el-icon :size="18">
						<Document />
					</el-icon>
				</div>
				<span class="pf-topbar-title">DocFlow</span>
			</div>

			<ClientOnly>
				<nav v-show="!isTopbarHamburger" class="pf-topbar-nav">
					<template v-for="(group, gi) in menuGroups" :key="group.title ?? 'default'">
						<span v-if="gi > 0" class="pf-topbar-divider" />
						<el-tooltip
							v-for="item in group.items" :key="item.to"
							:content="item.label" placement="bottom" :show-after="300"
							:disabled="!isTopbarIconOnly">
							<NuxtLink class="pf-topbar-link" :class="{ active: isItemActive(item) }" :to="item.to">
								<el-icon class="pf-topbar-link-icon">
									<component :is="item.icon" />
								</el-icon>
								<span class="pf-topbar-link-text">{{ item.label }}</span>
							</NuxtLink>
						</el-tooltip>
					</template>
				</nav>

				<!-- 汉堡菜单：仅小屏 (<1024px) 显示 -->
				<el-dropdown v-show="isTopbarHamburger" class="pf-topbar-hamburger" trigger="click" placement="bottom-start">
					<button class="pf-dark-toggle" type="button" aria-label="导航菜单">
						<el-icon :size="18"><Menu /></el-icon>
					</button>
					<template #dropdown>
						<el-dropdown-menu>
							<template v-for="(group, gi) in menuGroups" :key="group.title ?? 'default'">
								<el-dropdown-item
									v-for="(item, ii) in group.items" :key="item.to"
									:divided="gi > 0 && ii === 0"
									:class="{ 'pf-hamburger-item--active': isItemActive(item) }"
									@click="navigateTo(item.to)">
									<el-icon><component :is="item.icon" /></el-icon>
									{{ item.label }}
								</el-dropdown-item>
							</template>
						</el-dropdown-menu>
					</template>
				</el-dropdown>
			</ClientOnly>

			<div class="pf-topbar-actions">
				<el-tooltip :content="appStore.darkMode ? '切换亮色模式' : '切换暗黑模式'" placement="bottom" :show-after="400">
					<button
class="pf-dark-toggle" type="button" :aria-label="appStore.darkMode ? '切换亮色模式' : '切换暗黑模式'"
						@click="appStore.toggleDarkMode($event)">
						<el-icon :size="18">
							<Sunny v-if="appStore.darkMode" />
							<Moon v-else />
						</el-icon>
					</button>
				</el-tooltip>

				<el-tooltip v-if="isTopnav" content="切换布局" placement="bottom" :show-after="400">
					<button class="pf-dark-toggle" type="button" aria-label="切换布局" @click="appStore.toggleLayoutMode()">
						<el-icon :size="18">
							<Operation />
						</el-icon>
					</button>
				</el-tooltip>

				<ClientOnly>
					<NotificationBell v-if="isTopnav && authStore.isAuthenticated" />
				</ClientOnly>

				<ClientOnly>
					<el-dropdown
v-if="isTopnav && authStore.isAuthenticated && authStore.user" trigger="click"
						placement="bottom-end" @command="handleUserMenuCommand">
						<button class="pf-user-entry" type="button">
							<img
v-show="avatarReady" class="pf-user-entry-avatar" :src="authStore.user.avatar"
								@load="avatarLoaded = true" @error="avatarLoadFailed = true">
							<span v-show="!avatarReady" class="pf-user-entry-avatar pf-user-entry-avatar--text">{{ userInitial
							}}</span>
							<span class="pf-user-entry-name">{{ authStore.user.name }}</span>
							<el-icon class="pf-user-entry-caret">
								<ArrowDownBold />
							</el-icon>
						</button>
						<template #dropdown>
							<el-dropdown-menu>
								<el-dropdown-item command="profile">个人中心</el-dropdown-item>
								<el-dropdown-item divided command="logout">退出登录</el-dropdown-item>
							</el-dropdown-menu>
						</template>
					</el-dropdown>

					<NuxtLink v-else-if="isTopnav" class="pf-btn ghost" to="/login">去登录</NuxtLink>
				</ClientOnly>
			</div>
		</header>

		<section class="pf-main">
			<Transition name="offline-bar">
				<div v-if="!isOnline" class="df-offline-bar">
					<el-icon :size="16">
						<WarningFilled />
					</el-icon>
					网络已断开，请检查网络连接
				</div>
			</Transition>
			<!-- 侧栏模式保留原 header -->
			<header v-show="!isTopnav" class="pf-header">
				<div class="pf-header-actions">
					<el-tooltip :content="appStore.darkMode ? '切换亮色模式' : '切换暗黑模式'" placement="bottom" :show-after="400">
						<button
class="pf-dark-toggle" type="button" :aria-label="appStore.darkMode ? '切换亮色模式' : '切换暗黑模式'"
							@click="appStore.toggleDarkMode($event)">
							<el-icon :size="18">
								<Sunny v-if="appStore.darkMode" />
								<Moon v-else />
							</el-icon>
						</button>
					</el-tooltip>

					<el-tooltip v-if="!isTopnav" content="切换布局" placement="bottom" :show-after="400">
						<button class="pf-dark-toggle" type="button" aria-label="切换布局" @click="appStore.toggleLayoutMode()">
							<el-icon :size="18">
								<Operation />
							</el-icon>
						</button>
					</el-tooltip>

					<ClientOnly>
						<NotificationBell v-if="!isTopnav && authStore.isAuthenticated" />
					</ClientOnly>

					<ClientOnly>
						<el-dropdown
v-if="!isTopnav && authStore.isAuthenticated && authStore.user" trigger="click"
							placement="bottom-end" @command="handleUserMenuCommand">
							<button class="pf-user-entry" type="button">
								<img
v-show="avatarReady" class="pf-user-entry-avatar" :src="authStore.user.avatar"
									@load="avatarLoaded = true" @error="avatarLoadFailed = true">
								<span v-show="!avatarReady" class="pf-user-entry-avatar pf-user-entry-avatar--text">{{ userInitial
								}}</span>
								<span class="pf-user-entry-name">{{ authStore.user.name }}</span>
								<el-icon class="pf-user-entry-caret">
									<ArrowDownBold />
								</el-icon>
							</button>
							<template #dropdown>
								<el-dropdown-menu>
									<el-dropdown-item command="profile">个人中心</el-dropdown-item>
									<el-dropdown-item divided command="logout">退出登录</el-dropdown-item>
								</el-dropdown-menu>
							</template>
						</el-dropdown>

						<NuxtLink v-else-if="!isTopnav" class="pf-btn ghost" to="/login">去登录</NuxtLink>
					</ClientOnly>
				</div>
			</header>

			<!-- 固定布局页（fixedLayout meta = true）：纯 flex 容器，不要外层滚动条，内部自行高度分配 -->
			<!-- 普通页：外层 el-scrollbar 支持页面整体滚动 -->
			<!-- 两分支独立渲染（不用 <component :is> 动态切换）：ElScrollbar 内部有
			     ResizeObserver + 多层 DOM + ref，Vue 原地 patch 到 'div' 时会访问
			     已销毁节点的 type/parentNode 报错 —— 拆分后走完整 unmount/mount 路径 -->
			<div v-if="isFixedLayout" class="pf-content-area pf-content-area--fixed">
				<main class="pf-content pf-content--fixed">
					<div v-show="pageLoading" class="df-page-skeleton">
						<div
class="df-skeleton-block"
							style="width: 180px; height: 22px; border-radius: 4px; margin-bottom: 8px;" />
						<div
class="df-skeleton-block"
							style="width: 280px; height: 14px; border-radius: 4px; margin-bottom: 24px;" />
						<div class="df-page-skeleton-cards">
							<div v-for="i in 4" :key="i" class="df-page-skeleton-card">
								<div
class="df-skeleton-block"
									style="width: 60%; height: 12px; border-radius: 4px; margin-bottom: 12px;" />
								<div class="df-skeleton-block" style="width: 40%; height: 28px; border-radius: 4px;" />
							</div>
						</div>
						<div class="df-skeleton-block" style="width: 100%; height: 240px; border-radius: 12px; margin-top: 20px;" />
					</div>
					<div v-show="!pageLoading" style="height: 100%;">
						<NuxtErrorBoundary>
							<slot />
							<template #error="{ error, clearError }">
								<div class="df-error-boundary">
									<el-result icon="warning" title="页面加载异常" :sub-title="error?.message || '发生了未知错误'">
										<template #extra>
											<el-button type="primary" @click="clearError">重试</el-button>
											<el-button @click="navigateTo('/docs')">返回首页</el-button>
										</template>
									</el-result>
								</div>
							</template>
						</NuxtErrorBoundary>
					</div>
				</main>
			</div>
			<el-scrollbar v-else class="pf-content-scrollbar">
				<main class="pf-content">
					<div v-show="pageLoading" class="df-page-skeleton">
						<div
class="df-skeleton-block"
							style="width: 180px; height: 22px; border-radius: 4px; margin-bottom: 8px;" />
						<div
class="df-skeleton-block"
							style="width: 280px; height: 14px; border-radius: 4px; margin-bottom: 24px;" />
						<div class="df-page-skeleton-cards">
							<div v-for="i in 4" :key="i" class="df-page-skeleton-card">
								<div
class="df-skeleton-block"
									style="width: 60%; height: 12px; border-radius: 4px; margin-bottom: 12px;" />
								<div class="df-skeleton-block" style="width: 40%; height: 28px; border-radius: 4px;" />
							</div>
						</div>
						<div class="df-skeleton-block" style="width: 100%; height: 240px; border-radius: 12px; margin-top: 20px;" />
					</div>
					<div v-show="!pageLoading" style="height: 100%;">
						<NuxtErrorBoundary>
							<slot />
							<template #error="{ error, clearError }">
								<div class="df-error-boundary">
									<el-result icon="warning" title="页面加载异常" :sub-title="error?.message || '发生了未知错误'">
										<template #extra>
											<el-button type="primary" @click="clearError">重试</el-button>
											<el-button @click="navigateTo('/docs')">返回首页</el-button>
										</template>
									</el-result>
								</div>
							</template>
						</NuxtErrorBoundary>
					</div>
				</main>
			</el-scrollbar>

			<el-backtop v-if="!isFixedLayout" target=".pf-content-scrollbar .el-scrollbar__wrap" :right="28" :bottom="80" />
		</section>
	</div>
</template>

<script setup>
import {
	Delete,
	Document,
	DocumentChecked,
	Expand,
	Fold,
	Folder,
	ArrowDownBold,
	Menu,
	Moon,
	Operation,
	Setting,
	Sunny,
	User,
	WarningFilled
} from '@element-plus/icons-vue'
import { storeToRefs } from 'pinia'

import { useAppStore } from '~/stores/app'
import { useAuthStore } from '~/stores/auth'
import { useLocale } from '~/composables/useLocale'

const { currentLocale: _currentLocale, toggleLocale: _toggleLocale } = useLocale()

const { isOnline } = useOnline()
const route = useRoute()
const appStore = useAppStore()
const authStore = useAuthStore()
const { sidebarCollapsed: isSidebarCollapsed } = storeToRefs(appStore)

const isTopnav = computed(() => appStore.layoutMode === 'topnav')

// 固定布局页（列表型）— 由页面通过 definePageMeta({ fixedLayout: true }) 声明，不使用外层 el-scrollbar
const isFixedLayout = computed(() => Boolean(route.meta.fixedLayout))

const userInitial = computed(() => {
	const name = authStore.user?.name?.trim() || '访客'
	return name.slice(0, 1)
})

const isTopbarIconOnly = ref(false)
const isTopbarHamburger = ref(false)

const avatarLoadFailed = ref(false)
const avatarLoaded = ref(false)
const avatarReady = computed(() => {
	const url = authStore.user?.avatar
	return !!url && url.startsWith('http') && avatarLoaded.value && !avatarLoadFailed.value
})

// 用户或头像变化时重置加载状态
watch(() => authStore.user?.avatar, () => {
	avatarLoadFailed.value = false
	avatarLoaded.value = false
})

const { can } = useAuth()

const menuGroupsRaw = [
	{
		title: '文档协同',
		items: [
			{ to: '/docs', label: '共享文档', icon: Folder, activeMode: 'prefix' },
			{ to: '/profile', label: '个人中心', icon: User, activeMode: 'exact' },
			{ to: '/approvals', label: '审批中心', icon: DocumentChecked, activeMode: 'exact' },
			{ to: '/recycle-bin', label: '回收站', icon: Delete, activeMode: 'exact' }
		]
	},
	{
		title: '系统',
		items: [
			{ to: '/logs', label: '操作日志', icon: Document, activeMode: 'exact', perm: 'log:read' },
			{ to: '/admin', label: '系统管理', icon: Setting, activeMode: 'exact', perm: 'admin:user_read' },
			// ──────────────────────────────────────────────────────────────
			// 以下两项为 nuxt-fullstack-starter 模板的通用 RBAC 管理入口。
			// DocFlow 业务不暴露该入口（见 docs/dev-progress.md 说明），
			// 页面 pages/system/roles.vue / pages/system/user-roles.vue 仍在代码中可供直接访问。
			// 抽离 starter 时取消下两行注释即可。
			// { to: '/system/roles',      label: 'RBAC 角色管理', icon: Setting, activeMode: 'exact', perm: 'role:read' },
			// { to: '/system/user-roles', label: 'RBAC 用户授权', icon: Setting, activeMode: 'exact', perm: 'role:assign' },
		]
	}
]

// 按权限过滤：item.perm 未指定时人人可见；指定时需 can(perm) 为真
const menuGroups = computed(() =>
	menuGroupsRaw
		.map(g => ({ ...g, items: g.items.filter(i => !i.perm || can(i.perm)) }))
		.filter(g => g.items.length > 0),
)

const toggleSidebar = () => {
	_userManualToggle = true
	appStore.toggleSidebarCollapsed()
}

// ── 页面切换骨架屏 ──
const nuxtApp = useNuxtApp()
const pageLoading = ref(false)

nuxtApp.hook('page:start', () => {
	pageLoading.value = true
})

nuxtApp.hook('page:finish', () => {
	pageLoading.value = false
})

onMounted(() => {
	appStore.hydrateSidebarCollapsed()
	appStore.hydrateDarkMode()
	appStore.hydrateLayoutMode()
	handleResize()
	window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
	window.removeEventListener('resize', handleResize)
})

// ── 响应式侧栏折叠 ──
const COLLAPSE_BREAKPOINT = 1024
let _userManualToggle = false

const handleResize = () => {
	const w = window.innerWidth
	const narrow = w < COLLAPSE_BREAKPOINT
	isTopbarIconOnly.value = w >= COLLAPSE_BREAKPOINT && w < 1280
	isTopbarHamburger.value = w < COLLAPSE_BREAKPOINT
	if (narrow && !isSidebarCollapsed.value) {
		appStore.setSidebarCollapsed(true)
		_userManualToggle = false
	} else if (!narrow && isSidebarCollapsed.value && !_userManualToggle) {
		// 宽屏且非用户手动折叠 → 自动展开
		appStore.setSidebarCollapsed(false)
	}
}

const handleLogout = async () => {
	try {
		await $fetch('/api/auth/logout', {
			method: 'POST',
			body: {
				refreshToken: authStore.refreshToken
			}
		})
	} catch {
		// Logout still proceeds locally even if backend call fails.
	}

	authStore.clearSession()
	msgSuccess('已退出登录')
	await navigateTo('/login')
}

const handleUserMenuCommand = async (command) => {
	if (command === 'profile') {
		await navigateTo('/profile')
		return
	}

	if (command === 'logout') {
		await handleLogout()
	}
}

const isItemActive = (item) => (item.activeMode === 'prefix' ? route.path.startsWith(item.to) : route.path === item.to)
</script>
