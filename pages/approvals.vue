<template>
	<ListPageShell>
		<template #header>
			<PageTitle title="审批中心" subtitle="待我审批、我发起、我已处理" :refreshing="loading" @refresh="load" />
		</template>

		<template #filter>
			<div class="approvals-toolbar">
				<TabBar v-model="tab" :tabs="tabs" @update:model-value="onTabChange" />
				<FilterBar
					v-if="statusFilterEnabled"
					:clear-count="filterGroupClearCount"
					@clear="onClearStatus">
					<div class="df-filter-item">
						<label class="df-filter-label">状态</label>
						<el-select
							v-model="filterStatus"
							placeholder="全部状态"
							clearable
							@change="onFilterChange"
							@clear="onFilterChange">
							<el-option
								v-for="opt in statusOptions"
								:key="opt.value"
								:label="opt.label"
								:value="opt.value" />
						</el-select>
					</div>
				</FilterBar>
			</div>
		</template>

		<div class="approvals-body">
			<div v-if="loading && list.length === 0" class="approvals-loading">
				<el-icon class="is-loading"><Loading /></el-icon>
				<span>加载中...</span>
			</div>

			<EmptyState v-else-if="list.length === 0" :preset="emptyPreset" />

			<el-scrollbar v-else class="approvals-list">
				<div class="approvals-list-inner">
					<ApprovalListCard
						v-for="item in list"
						:key="item.id"
						:item="item"
						:tab="tab"
						:withdrawing="withdrawingId === item.id"
						@withdraw="onWithdraw" />
				</div>
			</el-scrollbar>

			<div v-if="total > 0" class="approvals-pagination">
				<Pagination
					v-model:page="page"
					v-model:page-size="pageSize"
					:total="total"
					:page-sizes="[10, 15, 30, 50]"
					@change="onPageChange" />
			</div>
		</div>
	</ListPageShell>
</template>

<script setup lang="ts">
import { Loading } from '@element-plus/icons-vue'
import { apiGetApprovals, apiWithdrawApproval } from '~/api/approvals'
import type { ApprovalItem, ApprovalListQuery, ApprovalTab, ApprovalStatus } from '~/types/approval'

definePageMeta({
	layout: 'prototype',
	fixedLayout: true,
})
useHead({ title: '审批中心 - DocFlow' })

const tabs: Array<{ value: ApprovalTab; label: string }> = [
	{ value: 'pending',   label: '待我审批' },
	{ value: 'submitted', label: '我发起的' },
	{ value: 'handled',   label: '我已处理' },
]

const tab = ref<ApprovalTab>('pending')
const filterStatus = ref<ApprovalStatus | null>(null)
const withdrawingId = ref<number | null>(null)

// pending tab 下状态恒为审批中，状态筛选无意义；其他 tab 开放筛选
const statusFilterEnabled = computed(() => tab.value !== 'pending')

const filterGroupClearCount = computed(() => (filterStatus.value != null ? 1 : 0))

const statusOptions: Array<{ label: string; value: ApprovalStatus }> = [
	{ value: 2, label: '审批中' },
	{ value: 3, label: '已通过' },
	{ value: 4, label: '已驳回' },
	{ value: 5, label: '已撤回' },
]

const emptyPreset = computed(() => {
	if (tab.value === 'pending')   return 'no-pending'
	if (tab.value === 'submitted') return 'no-initiated'
	return 'no-completed'
})

const {
	page,
	pageSize,
	list,
	total,
	loading,
	refresh: load,
	onFilterChange,
	onPageChange,
} = useListPage<ApprovalItem, ApprovalListQuery>({
	fetchFn: apiGetApprovals,
	buildQuery: ({ page, pageSize }) => ({
		tab: tab.value,
		status: statusFilterEnabled.value ? (filterStatus.value ?? undefined) : undefined,
		page,
		pageSize,
	}),
})

function onTabChange() {
	// 切 tab 时清状态筛选（pending tab 本就不支持，且切到其他 tab 从"全部"开始更直观）
	filterStatus.value = null
	onFilterChange()
}

function onClearStatus() {
	filterStatus.value = null
	onFilterChange()
}

async function onWithdraw(id: number) {
	const item = list.value.find(x => x.id === id)
	if (!item) return
	const confirmed = await msgConfirm(
		`撤回后需要重新上传提交。确定撤回「${item.title}」的审批？`,
		'撤回审批',
		{ type: 'warning', confirmText: '确认撤回', danger: true },
	)
	if (!confirmed) return
	withdrawingId.value = id
	try {
		const res = await apiWithdrawApproval(id)
		if (res.success) {
			msgSuccess(res.message || '已撤回审批')
			load()
		} else {
			msgError(res.message || '撤回失败')
		}
	} catch {
		msgError('撤回失败')
	} finally {
		withdrawingId.value = null
	}
}
</script>

<style lang="scss" scoped>
.approvals-toolbar {
	display: flex;
	flex-direction: column;
	gap: 12px;
}

.approvals-body {
	display: flex;
	flex-direction: column;
	flex: 1;
	min-height: 0;
}

.approvals-list {
	flex: 1;
	min-height: 0;
}

.approvals-list-inner {
	display: flex;
	flex-direction: column;
	gap: 10px;
	// 右侧给滚动条预留呼吸空间（el-scrollbar 默认 thumb 紧贴容器右边）
	padding: 4px 12px 4px 0;
}

.approvals-loading {
	flex: 1;
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 8px;
	color: var(--df-subtext);

	.el-icon {
		font-size: 18px;
	}
}

.approvals-pagination {
	margin-top: 12px;
}
</style>
