<template>
  <section class="pf-page-stack">
    <PageTitle title="回收站" subtitle="文件恢复与永久删除" />

    <div class="pf-card">
      <div class="pf-section-head">
        <h4>回收站文件（雏形）</h4>
        <div class="pf-inline-actions">
          <button class="pf-btn ghost">批量恢复</button>
          <button class="pf-btn danger">永久删除</button>
        </div>
      </div>

      <table class="pf-table">
        <thead>
          <tr>
            <th>文件名</th>
            <th>原仓库</th>
            <th>删除人</th>
            <th>删除时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in deletedFiles" :key="item.id">
            <td>{{ item.name }}</td>
            <td>{{ item.repo }}</td>
            <td>{{ item.operator }}</td>
            <td>{{ item.time }}</td>
            <td><button class="pf-link-btn">查看</button></td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<script setup>
definePageMeta({
  layout: 'prototype'
})

const deletedFiles = [
  { id: 1, name: '旧版产品概述.pdf', repo: '产品需求组', operator: '张晓明', time: '2026-03-11 09:30' },
  { id: 2, name: '历史投放策略.md', repo: '增长平台组', operator: '王敏', time: '2026-03-10 14:05' }
]
</script>
