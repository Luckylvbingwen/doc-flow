<template>
  <section class="login-page">
    <article class="login-card">
      <h2>DocFlow 登录</h2>
      <p>原型展示页雏形：后续可接入 SSO / OAuth / 内部认证。</p>

      <label>邮箱</label>
      <input placeholder="name@company.com" />

      <label>密码</label>
      <input placeholder="请输入密码" type="password" />

      <button class="pf-btn primary full">登录</button>
      <NuxtLink class="pf-link-btn" to="/docs">返回系统</NuxtLink>
    </article>
  </section>
</template>

<script setup>
definePageMeta({
  layout: 'prototype'
})
</script>
