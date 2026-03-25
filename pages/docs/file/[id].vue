<template>
  <section class="pf-page-stack">
    <PageTitle :title="fileName" subtitle="预览、版本、评论与审批记录">
      <template #actions>
        <button class="pf-btn">提交审批</button>
        <button class="pf-btn ghost">导入飞书评论</button>
      </template>
    </PageTitle>

    <div class="pf-card file-header">
      <div>
        <p class="pf-muted">文件ID：{{ route.params.id }} · 当前版本：v3.2 · 状态：审批中</p>
      </div>
    </div>

    <div class="file-split">
      <article class="pf-card preview-pane">
        <div class="pf-tabs compact">
          <span class="active">预览</span>
          <span>版本对比</span>
          <span>评论</span>
          <span>审批记录</span>
        </div>

        <div class="preview-doc">
          <h5>文档内容预览（雏形）</h5>
          <p>这里对齐原型中的文档预览区，后续可接入 Markdown / Office / PDF 渲染。</p>
          <p>
            当前季度用户转化率为
            <mark>12.5%</mark>
            ，并附带飞书批注挂点。
          </p>
          <p>后续将按原型补齐批注 popover、定位跳转、版本变更高亮。</p>
        </div>
      </article>

      <aside class="pf-card version-pane">
        <h5>版本历史</h5>
        <ul>
          <li class="active">v3.2（当前）</li>
          <li>v3.1</li>
          <li>v3.0</li>
          <li>v2.9</li>
        </ul>
      </aside>
    </div>
  </section>
</template>

<script setup>
definePageMeta({
  layout: 'prototype'
})

const route = useRoute()
const fileName = '2026Q2 增长策略说明.md'
</script>
