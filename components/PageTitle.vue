<template>
	<div class="page-title">
		<div class="page-title-text">
			<div class="page-title-main">
				<h2>{{ title }}</h2>
				<el-button
v-if="showRefresh" class="title-refresh-btn" link circle :icon="RefreshRight"
					:loading="refreshing" @click="onRefresh" />
				<slot name="after-title" />
			</div>
			<p v-if="subtitle">{{ subtitle }}</p>
		</div>
		<div v-if="$slots.actions" class="page-title-actions">
			<slot name="actions" />
		</div>
	</div>
</template>

<script setup lang="ts">
import { RefreshRight } from '@element-plus/icons-vue'

interface PageTitleProps {
	title: string
	subtitle?: string
	showRefresh?: boolean
	refreshing?: boolean
}

const props = withDefaults(defineProps<PageTitleProps>(), {
	subtitle: '',
	showRefresh: true,
	refreshing: false,
})

const emit = defineEmits<{
	'refresh': []
}>()

const onRefresh = () => {
	if (props.refreshing) return
	emit('refresh')
}
</script>

<style lang="scss" scoped>
.page-title {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 16px;
	margin-bottom: 14px;

	&-main {
		display: flex;
		align-items: center;
		gap: 8px;

		.title-refresh-btn {
			font-size: 16px;
			color: var(--df-subtext);

			&:hover {
				color: var(--el-color-primary);
			}
		}
	}

	&-text {
		h2 {
			font-size: 20px;
			font-weight: 700;
			color: var(--df-text);
			margin: 0;
		}

		p {
			font-size: 13px;
			color: var(--df-subtext);
			margin: 4px 0 0;
		}
	}

	&-actions {
		display: flex;
		align-items: center;
		gap: 8px;
	}
}
</style>
