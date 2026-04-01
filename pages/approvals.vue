<template>
	<section class="pf-page-stack">
		<PageTitle title="审批中心" subtitle="待我审批、我发起、归档记录" />

		<div class="pf-card">
			<div class="pf-tabs">
				<span class="active">待我审批</span>
				<span>我发起的</span>
				<span>已归档</span>
			</div>

			<table class="pf-table">
				<thead>
					<tr>
						<th>标题</th>
						<th>发起人</th>
						<th>当前节点</th>
						<th>时间</th>
						<th>操作</th>
					</tr>
				</thead>
				<tbody>
					<tr v-for="item in items" :key="item.id">
						<td>{{ item.title }}</td>
						<td>{{ item.owner }}</td>
						<td>{{ item.node }}</td>
						<td>{{ item.time }}</td>
						<td><button class="pf-link-btn">去审批</button></td>
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
useHead({ title: '审批中心 - DocFlow' })

const items = [
	{ id: 1, title: '增长策略文档 v3.2', owner: '王敏', node: '产品负责人审批', time: '2026-03-23 09:50' },
	{ id: 2, title: '会员权益规则 v1.8', owner: '赵亮', node: '研发负责人审批', time: '2026-03-22 18:20' }
]
</script>
