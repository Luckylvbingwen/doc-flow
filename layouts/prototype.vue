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
        <div class="pf-user-avatar">刘</div>
        <div v-show="!isSidebarCollapsed">
          <div class="pf-user-name">刘思远</div>
          <div class="pf-user-role">系统管理员</div>
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
          <NuxtLink class="pf-btn ghost" to="/login">查看登录页</NuxtLink>
          <NuxtLink class="pf-btn primary" to="/docs">返回原型主链路</NuxtLink>
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
  User
} from '@element-plus/icons-vue'
import { storeToRefs } from 'pinia'

import { useAppStore } from '~/stores/app'

const route = useRoute()
const appStore = useAppStore()
const { sidebarCollapsed: isSidebarCollapsed } = storeToRefs(appStore)

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
})

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
