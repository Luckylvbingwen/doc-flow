<template>
  <section class="pf-page-stack">
    <div class="pf-card">
      <div class="pf-tabs">
        <span class="active">组织与角色</span>
        <span>权限策略</span>
        <span>系统配置</span>
      </div>

      <div class="admin-grid">
        <article class="pf-card sub">
          <h5>组织管理</h5>
          <p>部门、产品线、团队层级维护入口。</p>
        </article>
        <article class="pf-card sub">
          <h5>角色管理</h5>
          <p>系统管理员、部门管理员、组负责人等角色策略。</p>
        </article>
        <article class="pf-card sub">
          <h5>系统设置</h5>
          <p>回收站保留天数、通知策略、默认审批流。</p>
        </article>
      </div>
    </div>
  </section>
</template>

<script setup>
definePageMeta({
  layout: 'prototype'
})
</script>
