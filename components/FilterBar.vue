<template>
	<div class="df-filter-bar">
		<div class="df-filter-body">
			<slot />
		</div>
		<div v-if="clearCount > 0" class="df-filter-actions">
			<el-button plain class="df-filter-clear" @click="emit('clear')">
				{{ clearText || `清除筛选 (${clearCount})` }}
			</el-button>
		</div>
	</div>
</template>

<script setup lang="ts">
/**
 * 筛选条卡片
 * - 默认 grid 布局：每列 minmax(180px, 1fr)，随容器自适应
 * - 单元格用法：<div class="df-filter-item"><label>标签</label>…控件…</div>
 * - 跨两列用法：<div class="df-filter-item df-filter-item--double">（如日期范围）
 * - clearCount>0 时右侧显示「清除筛选 (N)」按钮，点击触发 @clear
 */
withDefaults(
	defineProps<{
		clearCount?: number
		clearText?: string
	}>(),
	{
		clearCount: 0,
		clearText: '',
	},
)

const emit = defineEmits<{
	(event: 'clear'): void
}>()
</script>
