<template>
	<div class="stats-card" :class="{ 'is-loading': loading }">
		<el-skeleton v-if="loading" :rows="2" animated class="stats-card__skeleton" />
		<template v-else>
			<div class="stats-card__header">
				<el-icon v-if="icon" class="stats-card__icon">
					<component :is="resolvedIcon" />
				</el-icon>
				<span class="stats-card__label">{{ label }}</span>
			</div>
			<div class="stats-card__value">{{ value }}</div>
			<div v-if="trend || trendText" class="stats-card__trend" :class="trendClass">
				<el-icon v-if="trend === 'up'">
					<ArrowUp />
				</el-icon>
				<el-icon v-else-if="trend === 'down'">
					<ArrowDown />
				</el-icon>
				<el-icon v-else-if="trend === 'flat'">
					<Minus />
				</el-icon>
				<span v-if="trendText" class="stats-card__trend-text">{{ trendText }}</span>
			</div>
		</template>
	</div>
</template>

<script setup lang="ts">
import { ArrowUp, ArrowDown, Minus } from '@element-plus/icons-vue'
import * as ElIcons from '@element-plus/icons-vue'

const props = withDefaults(defineProps<{
	value: number | string
	label: string
	trend?: 'up' | 'down' | 'flat'
	trendText?: string
	icon?: string
	loading?: boolean
}>(), {
	trend: undefined,
	trendText: undefined,
	icon: undefined,
	loading: false,
})

const resolvedIcon = computed(() => {
	if (!props.icon) return null
	return (ElIcons as Record<string, unknown>)[props.icon] ?? null
})

const trendClass = computed(() => ({
	'is-up': props.trend === 'up',
	'is-down': props.trend === 'down',
	'is-flat': props.trend === 'flat',
}))
</script>
