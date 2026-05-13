<template>
	<FilterBar :clear-count="activeFilterCount" @clear="onReset">
		<div class="df-filter-item">
			<label class="df-filter-label">操作类型</label>
			<el-select
				:model-value="actionType"
				placeholder="全部类型"
				clearable
				@change="onTypeChange"
				@clear="onTypeChange('')"
			>
				<el-option label="全部" :value="''" />
				<el-option v-for="t in LOG_TYPE_META" :key="t.code" :label="t.label" :value="t.code">
					<span class="activity-filter-bar__type-option">
						<el-icon :style="{ color: t.color }">
							<component :is="t.icon" />
						</el-icon>
						{{ t.label }}
					</span>
				</el-option>
			</el-select>
		</div>
		<div class="df-filter-item">
			<label class="df-filter-label">关键词</label>
			<el-input
				:model-value="keyword"
				placeholder="搜索操作人 / 描述 / 组名..."
				clearable
				@update:model-value="(v: string) => emit('update:keyword', v)"
				@keyup.enter="emit('search')"
				@clear="emit('search')"
			>
				<template #prefix>
					<el-icon><Search /></el-icon>
				</template>
			</el-input>
		</div>
		<div class="df-filter-item df-filter-item--double">
			<label class="df-filter-label">操作时间范围</label>
			<el-date-picker
				:model-value="dateRange"
				type="daterange"
				value-format="YYYY-MM-DD"
				range-separator="~"
				start-placeholder="开始日期"
				end-placeholder="结束日期"
				:clearable="true"
				@change="onDateRangeChange"
			/>
		</div>
	</FilterBar>
</template>

<script setup lang="ts">
import { Search } from '@element-plus/icons-vue'
import { LOG_TYPE_META, type LogTypeCode } from '~/utils/log-types'

const props = withDefaults(defineProps<{
	keyword?: string
	dateRange?: [string, string] | null
	actionType?: LogTypeCode | ''
}>(), {
	keyword: '',
	dateRange: null,
	actionType: '',
})

const emit = defineEmits<{
	'update:keyword': [value: string]
	'update:dateRange': [value: [string, string] | null]
	'update:actionType': [value: LogTypeCode | '']
	'search': []
	'reset': []
}>()

const activeFilterCount = computed(() => {
	let n = 0
	if (props.actionType) n++
	if (props.keyword) n++
	if (props.dateRange) n++
	return n
})

function onTypeChange(val: LogTypeCode | '' | undefined) {
	emit('update:actionType', (val ?? '') as LogTypeCode | '')
	emit('search')
}

function onDateRangeChange(val: [string, string] | null) {
	emit('update:dateRange', val)
	emit('search')
}

function onReset() {
	emit('update:keyword', '')
	emit('update:dateRange', null)
	emit('update:actionType', '')
	emit('reset')
}
</script>
