<template>
  <section class="pf-page-stack">
    <PageTitle title="通知中心" subtitle="系统通知、审批通知、提醒消息" />

    <div class="pf-card notification-list">
      <article v-for="n in notifications" :key="n.id" class="notice-item" :class="{ unread: !n.read }">
        <h5>{{ n.title }}</h5>
        <p>{{ n.content }}</p>
        <span>{{ n.time }}</span>
      </article>
    </div>
  </section>
</template>

<script setup>
definePageMeta({
  layout: 'prototype'
})

const notifications = [
  { id: 1, title: '审批提醒', content: '你有 2 条待审批文档，请及时处理。', time: '10分钟前', read: false },
  { id: 2, title: '系统通知', content: '组织架构已更新，权限将在 5 分钟内生效。', time: '今天 09:10', read: true },
  { id: 3, title: '评论通知', content: '刘思远在文档 v3.2 中新增 3 条飞书评论。', time: '昨天 17:34', read: true }
]
</script>
