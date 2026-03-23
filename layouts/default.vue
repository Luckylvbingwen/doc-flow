<template>
  <div class="layout-root">
    <header class="layout-header">
      <strong>{{ appName }}</strong>
      <span>Nuxt3 + Nitro + Prisma</span>
    </header>
    <main class="layout-main">
      <slot />
    </main>
  </div>
</template>

<script setup>
const config = useRuntimeConfig()
const appName = config.public.appName
</script>

<style scoped>
.layout-root {
  min-height: 100vh;
}

.layout-header {
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  background: #ffffffcc;
  backdrop-filter: blur(8px);
  border-bottom: 1px solid #e5e7eb;
}

.layout-main {
  max-width: 1080px;
  margin: 0 auto;
  padding: 24px;
}
</style>
