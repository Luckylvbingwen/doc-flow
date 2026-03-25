<template>
  <section class="pf-page-stack">
    <PageTitle title="个人中心" subtitle="我的信息、我的文档、偏好配置" />

    <div class="pf-card profile-head">
      <div class="pf-user-avatar lg">刘</div>
      <div>
        <h4>刘思远</h4>
        <p class="pf-muted">系统管理员 · liusy@co.com</p>
      </div>
    </div>

    <div class="admin-grid">
      <article class="pf-card sub">
        <h5>我的文档</h5>
        <p>最近编辑、我的收藏、待处理文档入口。</p>
      </article>
      <article class="pf-card sub">
        <h5>消息偏好</h5>
        <p>飞书通知、系统通知、审批提醒的订阅设置。</p>
      </article>
      <article class="pf-card sub">
        <h5>安全设置</h5>
        <p>密码管理、多因素认证、登录设备管理。</p>
      </article>
    </div>
  </section>
</template>

<script setup>
definePageMeta({
  layout: 'prototype'
})
</script>
