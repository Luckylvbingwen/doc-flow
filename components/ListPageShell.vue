<template>
	<div class="df-list-shell">
		<div v-if="$slots.header" class="df-list-shell-header">
			<slot name="header" />
		</div>
		<div v-if="$slots.filter" class="df-list-shell-filter">
			<slot name="filter" />
		</div>
		<div v-if="$slots.toolbar" class="df-list-shell-toolbar">
			<slot name="toolbar" />
		</div>
		<div class="df-list-shell-body">
			<slot />
		</div>
	</div>
</template>

<script setup lang="ts">
/**
 * 列表型页面外壳（配合 fixedLayout 使用）
 *
 * 用法：
 *   1) 页面声明 definePageMeta({ layout: 'prototype', fixedLayout: true })
 *      — 让 layout 用纯 flex 容器取代外层 el-scrollbar，把 100% 高度传递下来
 *   2) 用 <ListPageShell> 包裹：header / filter / toolbar / default slot
 *   3) 默认 slot 里放 <DataTable fill-height />，表格内部滚动、表头+分页常驻可视
 *
 * <ListPageShell>
 *   <template #header><PageTitle ... /></template>
 *   <template #filter><FilterBar ...>...</FilterBar></template>
 *   <template #toolbar>...右侧工具栏...</template>
 *   <DataTable fill-height ... />
 * </ListPageShell>
 */
</script>
