<template>
  <div class="pf-app">
    <aside class="pf-sidebar">
      <div class="pf-brand">
        <div class="pf-brand-logo">DF</div>
        <div class="pf-brand-text">DocFlow</div>
      </div>

      <nav class="pf-nav">
        <p class="pf-nav-title">文档协同</p>
        <NuxtLink class="pf-nav-item" :class="{ active: isActive('/docs') }" to="/docs">共享文档</NuxtLink>
        <NuxtLink class="pf-nav-item" :class="{ active: isExact('/approvals') }" to="/approvals">审批中心</NuxtLink>
        <NuxtLink class="pf-nav-item" :class="{ active: isExact('/logs') }" to="/logs">操作日志</NuxtLink>
        <NuxtLink class="pf-nav-item" :class="{ active: isExact('/recycle-bin') }" to="/recycle-bin">回收站</NuxtLink>

        <p class="pf-nav-title">系统</p>
        <NuxtLink class="pf-nav-item" :class="{ active: isExact('/notifications') }" to="/notifications">通知中心</NuxtLink>
        <NuxtLink class="pf-nav-item" :class="{ active: isExact('/admin') }" to="/admin">系统管理</NuxtLink>
        <NuxtLink class="pf-nav-item" :class="{ active: isExact('/profile') }" to="/profile">个人中心</NuxtLink>
      </nav>

      <div class="pf-user">
        <div class="pf-user-avatar">刘</div>
        <div>
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
const route = useRoute()

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

const isExact = (path) => route.path === path
const isActive = (prefix) => route.path.startsWith(prefix)
</script>
