<template>
	<section class="pf-page-stack">
		<PageTitle title="仓库详情" subtitle="文件列表与分组配置">
			<template #actions>
				<NuxtLink class="pf-btn ghost" to="/docs">返回仓库列表</NuxtLink>
				<button class="pf-btn">新建文档</button>
			</template>
		</PageTitle>

		<div class="pf-card">
			<div class="pf-section-head">
				<h4>仓库信息</h4>
			</div>
			<p class="pf-muted">仓库ID：{{ route.params.id }}，这里是文件列表与筛选区的雏形。</p>
		</div>

		<div class="pf-card">
			<div class="pf-tabs">
				<span class="active">文件列表</span>
				<span>审批流配置</span>
				<span>成员管理</span>
				<span>基本设置</span>
			</div>

			<table class="pf-table">
				<thead>
					<tr>
						<th>文件名</th>
						<th>版本</th>
						<th>状态</th>
						<th>更新时间</th>
						<th>操作</th>
					</tr>
				</thead>
				<tbody>
					<tr v-for="file in files" :key="file.id">
						<td>{{ file.name }}</td>
						<td>{{ file.version }}</td>
						<td>{{ file.status }}</td>
						<td>{{ file.updatedAt }}</td>
						<td>
							<NuxtLink :to="`/docs/file/${file.id}`">查看</NuxtLink>
						</td>
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
useHead({ title: '仓库详情 - DocFlow' })

const route = useRoute()

const files = [
	{ id: 101, name: '2026Q2 增长策略说明.md', version: 'v3.2', status: '审批中', updatedAt: '2026-03-23 10:30' },
	{ id: 102, name: '会员权益规则.docx', version: 'v1.8', status: '已发布', updatedAt: '2026-03-22 16:48' },
	{ id: 103, name: '接口字段映射表.xlsx', version: 'v2.0', status: '草稿', updatedAt: '2026-03-21 11:05' }
]
</script>
