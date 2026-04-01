<template>
	<section class="pf-page-stack">
		<PageTitle title="操作日志" subtitle="系统行为审计与检索" />

		<div class="pf-card">
			<div class="pf-section-head">
				<h4>操作日志检索（雏形）</h4>
				<div class="pf-inline-actions">
					<button class="pf-btn ghost">导出</button>
				</div>
			</div>

			<table class="pf-table">
				<thead>
					<tr>
						<th>类型</th>
						<th>操作者</th>
						<th>描述</th>
						<th>范围</th>
						<th>时间</th>
					</tr>
				</thead>
				<tbody>
					<tr v-for="log in logs" :key="log.id">
						<td>{{ log.type }}</td>
						<td>{{ log.user }}</td>
						<td>{{ log.desc }}</td>
						<td>{{ log.scope }}</td>
						<td>{{ log.time }}</td>
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
useHead({ title: '操作日志 - DocFlow' })

const logs = [
	{ id: 1, type: '文档发布', user: '王敏', desc: '发布 2026Q2 增长策略说明', scope: '增长平台组', time: '2026-03-23 10:00' },
	{ id: 2, type: '文件删除', user: '赵亮', desc: '删除旧版产品概述（移入回收站）', scope: '会员产品组', time: '2026-03-22 20:12' }
]
</script>
