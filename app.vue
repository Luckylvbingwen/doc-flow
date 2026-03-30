<template>
  <ElConfigProvider :locale="elLocale">
    <div v-show="showSkeleton" class="df-skeleton-page">
      <aside class="df-skeleton-sidebar">
        <div class="df-skeleton-brand">
          <div class="df-skeleton-block" style="width: 32px; height: 32px; border-radius: 8px;" />
          <div class="df-skeleton-block" style="width: 80px; height: 14px; border-radius: 4px;" />
        </div>
        <div class="df-skeleton-nav">
          <div v-for="i in 6" :key="i" class="df-skeleton-nav-item">
            <div class="df-skeleton-block" style="width: 18px; height: 18px; border-radius: 4px;" />
            <div class="df-skeleton-block" style="flex: 1; height: 12px; border-radius: 4px;" />
          </div>
        </div>
      </aside>
      <section class="df-skeleton-main">
        <header class="df-skeleton-header">
          <div class="df-skeleton-block" style="width: 120px; height: 16px; border-radius: 4px;" />
          <div class="df-skeleton-block" style="width: 80px; height: 32px; border-radius: 16px;" />
        </header>
        <div class="df-skeleton-content">
          <div class="df-skeleton-block" style="width: 200px; height: 22px; border-radius: 4px; margin-bottom: 8px;" />
          <div class="df-skeleton-block" style="width: 300px; height: 14px; border-radius: 4px; margin-bottom: 24px;" />
          <div class="df-skeleton-cards">
            <div v-for="i in 4" :key="i" class="df-skeleton-card">
              <div class="df-skeleton-block" style="width: 60%; height: 12px; border-radius: 4px; margin-bottom: 12px;" />
              <div class="df-skeleton-block" style="width: 40%; height: 28px; border-radius: 4px;" />
            </div>
          </div>
          <div class="df-skeleton-block" style="width: 100%; height: 200px; border-radius: 12px; margin-top: 20px;" />
        </div>
      </section>
    </div>
    <div v-show="!showSkeleton" style="height: 100%;">
      <NuxtLayout>
        <NuxtPage />
      </NuxtLayout>
    </div>
  </ElConfigProvider>
</template>

<script setup>
import elZhCn from 'element-plus/es/locale/lang/zh-cn'
import elEn from 'element-plus/es/locale/lang/en'
import { useAppStore } from '~/stores/app'

const appStore = useAppStore()
const route = useRoute()
const authReady = ref(false)

// 登录等 auth 布局页面不需要侧边栏骨架屏，直接展示内容
const isAuthLayout = computed(() => route.path === '/login')
const showSkeleton = computed(() => !authReady.value && !isAuthLayout.value)

const elLocale = computed(() => appStore.locale === 'en-US' ? elEn : elZhCn)

onMounted(() => {
  nextTick(() => {
    authReady.value = true
  })
})
</script>

<style lang="scss">
/* ── 全局骨架屏 ── */
.df-skeleton-page {
  display: flex;
  height: 100vh;
  background: var(--df-bg, #f5f5f5);
}

.df-skeleton-sidebar {
  width: 240px;
  background: var(--df-panel, #fff);
  border-right: 1px solid var(--df-border, #e4e4e7);
  display: flex;
  flex-direction: column;
  padding: 0;
}

.df-skeleton-brand {
  height: 52px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 14px;
  border-bottom: 1px solid var(--df-border, #e4e4e7);
}

.df-skeleton-nav {
  padding: 16px 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.df-skeleton-nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 8px;
}

.df-skeleton-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.df-skeleton-header {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 22px;
  border-bottom: 1px solid var(--df-border, #e4e4e7);
  background: var(--df-panel, #fff);
}

.df-skeleton-content {
  padding: 24px;
}

.df-skeleton-cards {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
}

.df-skeleton-card {
  background: var(--df-panel, #fff);
  border-radius: 12px;
  padding: 18px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}

.df-skeleton-block {
  background: linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: df-shimmer 1.5s ease-in-out infinite;
}

html.dark .df-skeleton-block {
  background: linear-gradient(90deg, #2a2e38 25%, #333842 50%, #2a2e38 75%);
  background-size: 200% 100%;
}

@keyframes df-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* ── 页面切换骨架屏 ── */
.df-page-skeleton {
  animation: df-fade-in 0.15s ease;
}

.df-page-skeleton-cards {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
}

.df-page-skeleton-card {
  background: var(--df-panel, #fff);
  border-radius: 12px;
  padding: 18px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}

@keyframes df-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
</style>
