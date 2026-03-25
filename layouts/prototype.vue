<template>
  <div class="pf-app">
    <aside class="pf-sidebar" :class="{ collapsed: isSidebarCollapsed }">
      <div class="pf-brand">
        <div class="pf-brand-logo">DF</div>
        <div v-show="!isSidebarCollapsed" class="pf-brand-text">DocFlow</div>
        <button
          class="pf-sidebar-toggle"
          type="button"
          :aria-label="isSidebarCollapsed ? '展开侧栏' : '收起侧栏'"
          @click="toggleSidebar"
        >
          <el-icon>
            <Expand v-if="isSidebarCollapsed" />
            <Fold v-else />
          </el-icon>
        </button>
      </div>

      <nav class="pf-nav">
        <template v-for="group in menuGroups" :key="group.title">
          <p class="pf-nav-title">{{ group.title }}</p>
          <NuxtLink
            v-for="item in group.items"
            :key="item.to"
            class="pf-nav-item"
            :class="{ active: isItemActive(item) }"
            :to="item.to"
            :title="item.label"
          >
            <el-icon class="pf-nav-icon">
              <component :is="item.icon" />
            </el-icon>
            <span class="pf-nav-label">{{ item.label }}</span>
          </NuxtLink>
        </template>
      </nav>

      <div class="pf-user">
        <div class="pf-user-avatar">{{ userInitial }}</div>
        <div v-show="!isSidebarCollapsed">
          <div class="pf-user-name">{{ authStore.user?.name || '未登录用户' }}</div>
          <div class="pf-user-role">{{ authStore.user?.email || '请先登录' }}</div>
        </div>
      </div>
    </aside>

    <section class="pf-main">
      <header class="pf-header">
        <div>
          <h1>{{ pageMeta.title }}</h1>
          <p>{{ pageMeta.subtitle }}</p>
        </div>
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

          <el-dropdown
            v-if="authStore.isAuthenticated && authStore.user"
            trigger="click"
            placement="bottom-end"
            @command="handleUserMenuCommand"
          >
            <button class="pf-user-entry" type="button">
              <span class="pf-user-entry-avatar">{{ userInitial }}</span>
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
        </div>
      </header>

      <main class="pf-content">
        <slot />
      </main>
    </section>
  </div>
</template>

<script setup>
import {
  Bell,
  Collection,
  Delete,
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
  appStore.toggleSidebarCollapsed()
}

onMounted(() => {
  appStore.hydrateSidebarCollapsed()
  appStore.hydrateDarkMode()
  authStore.hydrateSession()
})

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

const pageMeta = computed(() => {
  const path = route.path
  if (path.startsWith('/docs/file/')) {
    return { title: '文件详情', subtitle: '预览、版本、评论与审批记录' }
  }

  if (path.startsWith('/docs/repo/')) {
    return { title: '仓库详情', subtitle: '文件列表与分组配置' }
  }

  const map = {
    '/': { title: '原型落地导航', subtitle: '从这里进入各展示页面雏形' },
    '/docs': { title: '共享文档', subtitle: '组织树、仓库卡片、快速入口' },
    '/approvals': { title: '审批中心', subtitle: '待我审批、我发起、归档记录' },
    '/logs': { title: '操作日志', subtitle: '系统行为审计与检索' },
    '/notifications': { title: '通知中心', subtitle: '系统通知、审批通知、提醒消息' },
    '/admin': { title: '系统管理', subtitle: '组织、角色、权限与配置' },
    '/recycle-bin': { title: '回收站', subtitle: '文件恢复与永久删除' },
    '/profile': { title: '个人中心', subtitle: '我的信息、我的文档、偏好配置' },
    '/login': { title: '登录页面', subtitle: '账户登录与统一入口' }
  }

  return map[path] || { title: 'DocFlow', subtitle: '原型驱动开发' }
})

const isItemActive = (item) => (item.activeMode === 'prefix' ? route.path.startsWith(item.to) : route.path === item.to)
</script>
