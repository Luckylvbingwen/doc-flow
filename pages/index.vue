<template>
  <section class="home-grid">
    <el-card>
      <template #header>
        <div class="card-title">基础框架状态</div>
      </template>
      <p>项目名称：{{ config.public.appName }}</p>
      <p>运行环境：{{ config.public.appEnv }}</p>
      <p>Pinia状态：{{ appStore.workspaceReady ? '已启用' : '未启用' }}</p>
      <p>最后健康检查：{{ appStore.latestPingAt || '-' }}</p>
      <el-button type="primary" @click="pingHealth">调用 /api/health</el-button>
    </el-card>

    <el-card>
      <template #header>
        <div class="card-title">后续模块预留</div>
      </template>
      <ul>
        <li>文件预览：接入 Office / PDF / 图片渲染策略</li>
        <li>版本对比：文档diff与元数据差异</li>
        <li>飞书集成：机器人消息与审批流回调</li>
      </ul>
    </el-card>
  </section>
</template>

<script setup>
const config = useRuntimeConfig()
const appStore = useAppStore()

const pingHealth = async () => {
  const response = await $fetch('/api/health')
  if (response.ok) {
    appStore.markPinged()
  }
}
</script>

<style scoped>
.home-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 16px;
}

.card-title {
  font-weight: 600;
}

ul {
  margin: 0;
  padding-left: 18px;
  color: #4b5563;
}

li + li {
  margin-top: 8px;
}
</style>
