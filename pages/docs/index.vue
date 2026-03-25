<template>
  <section class="pf-page-stack">
    <PageTitle title="共享文档" subtitle="组织树、仓库卡片、快速入口" />

    <div class="pf-stat-grid">
      <article class="pf-card stat">
        <p>文档总数</p>
        <h3>326</h3>
      </article>
      <article class="pf-card stat">
        <p>待审批</p>
        <h3>18</h3>
      </article>
      <article class="pf-card stat">
        <p>飞书评论</p>
        <h3>57</h3>
      </article>
      <article class="pf-card stat">
        <p>今日更新</p>
        <h3>24</h3>
      </article>
    </div>

    <section class="pf-card explorer">
      <div class="explorer-tree">
        <h4>组织架构</h4>
        <ul>
          <li><strong>产品部</strong>
            <ul>
              <li>增长平台组</li>
              <li>会员产品组</li>
            </ul>
          </li>
          <li><strong>研发部</strong>
            <ul>
              <li>前端工程组</li>
              <li>后端工程组</li>
            </ul>
          </li>
        </ul>
      </div>

      <div class="explorer-content">
        <div class="pf-section-head">
          <h4>仓库列表（雏形）</h4>
          <NuxtLink class="pf-btn" to="/docs/repo/1">进入示例仓库</NuxtLink>
        </div>

        <div class="repo-grid">
          <article v-for="repo in repos" :key="repo.id" class="repo-card">
            <h5>{{ repo.name }}</h5>
            <p>{{ repo.description }}</p>
            <NuxtLink :to="`/docs/repo/${repo.id}`">查看详情</NuxtLink>
          </article>
        </div>
      </div>
    </section>
  </section>
</template>

<script setup>
definePageMeta({
  layout: 'prototype'
})

const repos = [
  { id: 1, name: '增长平台需求库', description: '增长策略、AB实验、投放规则文档集中管理。' },
  { id: 2, name: '会员产品规范库', description: '会员权益、价格策略、活动规则文档。' },
  { id: 3, name: '研发技术方案库', description: '系统设计、接口规范、发布记录。' }
]
</script>
