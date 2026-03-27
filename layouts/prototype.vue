<template>
  <div class="pf-app">
    <aside class="pf-sidebar" :class="{ collapsed: isSidebarCollapsed }">
      <div class="pf-brand">
        <div class="pf-brand-logo">
          <el-icon :size="20"><Document /></el-icon>
        </div>
        <span class="pf-brand-text">DocFlow</span>
        <button
          class="pf-sidebar-toggle"
          type="button"
          :aria-label="isSidebarCollapsed ? '展开侧栏' : '收起侧栏'"
          @click="toggleSidebar"
        >
          <el-icon :size="18">
            <Expand v-if="isSidebarCollapsed" />
            <Fold v-else />
          </el-icon>
        </button>
      </div>

      <el-scrollbar class="pf-nav-scrollbar">
      <nav class="pf-nav">
        <template v-for="group in menuGroups" :key="group.title">
          <p class="pf-nav-title">{{ group.title }}</p>
          <el-tooltip
            v-for="item in group.items"
            :key="item.to"
            :content="item.label"
            placement="right"
            :disabled="!isSidebarCollapsed"
            :show-after="300"
          >
            <NuxtLink
              class="pf-nav-item"
              :class="{ active: isItemActive(item) }"
              :to="item.to"
            >
              <el-icon class="pf-nav-icon">
                <component :is="item.icon" />
              </el-icon>
              <span class="pf-nav-label">{{ item.label }}</span>
            </NuxtLink>
          </el-tooltip>
        </template>
      </nav>
      </el-scrollbar>
    </aside>

    <section class="pf-main">
      <header class="pf-header">
        <div class="pf-header-actions">
          <button
            class="pf-dark-toggle"
            type="button"
            :aria-label="appStore.darkMode ? '切换亮色模式' : '切换暗黑模式'"
            @click="appStore.toggleDarkMode()"
          >
            <el-icon :size="18">
              <Sunny v-if="appStore.darkMode" />
              <Moon v-else />
            </el-icon>
          </button>

          <ClientOnly>
            <el-dropdown
              v-if="authStore.isAuthenticated && authStore.user"
              trigger="click"
              placement="bottom-end"
              @command="handleUserMenuCommand"
            >
              <button class="pf-user-entry" type="button">
                <img v-show="avatarReady" class="pf-user-entry-avatar" :src="authStore.user.avatar" @load="avatarLoaded = true" @error="avatarLoadFailed = true" />
                <span v-show="!avatarReady" class="pf-user-entry-avatar pf-user-entry-avatar--text">{{ userInitial }}</span>
                <span class="pf-user-entry-name">{{ authStore.user.name }}</span>
                <el-icon class="pf-user-entry-caret"><ArrowDownBold /></el-icon>
              </button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="profile">个人中心</el-dropdown-item>
                  <el-dropdown-item divided command="logout">退出登录</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>

            <NuxtLink v-else class="pf-btn ghost" to="/login">去登录</NuxtLink>
          </ClientOnly>
        </div>
      </header>

      <el-scrollbar class="pf-content-scrollbar">
        <main class="pf-content">
          <div v-if="pageLoading" class="df-page-skeleton">
            <div class="df-skeleton-block" style="width: 180px; height: 22px; border-radius: 4px; margin-bottom: 8px;" />
            <div class="df-skeleton-block" style="width: 280px; height: 14px; border-radius: 4px; margin-bottom: 24px;" />
            <div class="df-page-skeleton-cards">
              <div v-for="i in 4" :key="i" class="df-page-skeleton-card">
                <div class="df-skeleton-block" style="width: 60%; height: 12px; border-radius: 4px; margin-bottom: 12px;" />
                <div class="df-skeleton-block" style="width: 40%; height: 28px; border-radius: 4px;" />
              </div>
            </div>
            <div class="df-skeleton-block" style="width: 100%; height: 240px; border-radius: 12px; margin-top: 20px;" />
          </div>
          <slot v-else />
        </main>
      </el-scrollbar>
    </section>
  </div>
</template>

<script setup>
import {
  Bell,
  Collection,
  Delete,
  Document,
  Expand,
  Fold,
  Histogram,
  Management,
  ArrowDownBold,
  Moon,
  Sunny,
  User
} from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { storeToRefs } from 'pinia'

import { useAppStore } from '~/stores/app'
import { useAuthStore } from '~/stores/auth'

const route = useRoute()
const appStore = useAppStore()
const authStore = useAuthStore()
const { sidebarCollapsed: isSidebarCollapsed } = storeToRefs(appStore)

const userInitial = computed(() => {
  const name = authStore.user?.name?.trim() || '访客'
  return name.slice(0, 1)
})

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

const menuGroups = [
  {
    title: '文档协同',
    items: [
      { to: '/docs', label: '共享文档', icon: Collection, activeMode: 'prefix' },
      { to: '/approvals', label: '审批中心', icon: Management, activeMode: 'exact' },
      { to: '/logs', label: '操作日志', icon: Histogram, activeMode: 'exact' },
      { to: '/recycle-bin', label: '回收站', icon: Delete, activeMode: 'exact' }
    ]
  },
  {
    title: '系统',
    items: [
      { to: '/notifications', label: '通知中心', icon: Bell, activeMode: 'exact' },
      { to: '/admin', label: '系统管理', icon: Management, activeMode: 'exact' },
      { to: '/profile', label: '个人中心', icon: User, activeMode: 'exact' }
    ]
  }
]

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
  const narrow = window.innerWidth < COLLAPSE_BREAKPOINT
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
        token: authStore.token
      }
    })
  } catch {
    // Logout still proceeds locally even if backend call fails.
  }

  authStore.clearSession()
  ElMessage.success('已退出登录')
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
