<template>
	<ListPageShell>
		<template #header>
			<PageTitle title="审批中心" subtitle="待我审批、我发起、我已处理" :refreshing="loading" @refresh="load" />
		</template>

		<template #filter>
			<div class="approvals-toolbar">
				<TabBar v-model="tab" :tabs="tabs" @update:model-value="onTabChange" />
				<FilterBar v-if="statusFilterEnabled" :clear-count="filterGroupClearCount" @clear="onClearStatus">
					<div class="df-filter-item">
						<label class="df-filter-label">状态</label>
						<el-select
v-model="filterStatus" placeholder="全部状态" clearable @change="onFilterChange"
							@clear="onFilterChange">
							<el-option v-for="opt in statusOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
						</el-select>
					</div>
				</FilterBar>
			</div>
		</template>

		<div class="approvals-body">
			<div v-if="loading && list.length === 0" class="approvals-loading">
				<el-icon class="is-loading">
					<Loading />
				</el-icon>
				<span>加载中...</span>
			</div>

			<EmptyState v-else-if="list.length === 0" :preset="emptyPreset" />

			<el-scrollbar v-else class="approvals-list">
				<div class="approvals-list-inner">
					<ApprovalListCard
v-for="item in list" :key="item.id" :item="item" :tab="tab"
						:withdrawing="withdrawingId === item.id" @withdraw="onWithdraw" @open="openApprovalDetail" />
				</div>
			</el-scrollbar>

			<div v-if="total > 0" class="approvals-pagination">
				<Pagination
v-model:page="page" v-model:page-size="pageSize" :total="total" :page-sizes="[10, 15, 30, 50]"
					@change="onPageChange" />
			</div>
		</div>

		<ApprovalDrawer
v-model="drawerVisible" :approval="currentApproval" :approve-loading="approveLoading"
			:reject-loading="rejectLoading" @approve="onApprove" @reject="onReject" @view-file="onViewFile" />
	</ListPageShell>
</template>

<script setup lang="ts">
import { Loading } from '@element-plus/icons-vue'
import {
	apiGetApprovals,
	apiWithdrawApproval,
	apiGetApproval,
	apiApproveApproval,
	apiRejectApproval,
} from '~/api/approvals'
import type {
	ApprovalItem,
	ApprovalListQuery,
	ApprovalTab,
	ApprovalStatus,
	ApprovalDetail,
	ApprovalFullDetailData,
	ChangeSummaryItem,
	ChainNode,
} from '~/types/approval'
import type { CompareResult } from '~/types/version'
import type { ApiResponse } from '~/types/api'
import { formatTime } from '~/utils/format'

definePageMeta({
	layout: 'prototype',
	fixedLayout: true,
})
useHead({ title: '审批中心 - DocFlow' })

const tabs: Array<{ value: ApprovalTab; label: string }> = [
	{ value: 'pending', label: '待我审批' },
	{ value: 'submitted', label: '我发起的' },
	{ value: 'handled', label: '我已处理' },
]

const tab = ref<ApprovalTab>('pending')
const filterStatus = ref<ApprovalStatus | null>(null)
const withdrawingId = ref<number | null>(null)

const statusFilterEnabled = computed(() => tab.value !== 'pending')
const filterGroupClearCount = computed(() => (filterStatus.value != null ? 1 : 0))

const statusOptions: Array<{ label: string; value: ApprovalStatus }> = [
	{ value: 2, label: '审批中' },
	{ value: 3, label: '已通过' },
	{ value: 4, label: '已驳回' },
	{ value: 5, label: '已撤回' },
]

const emptyPreset = computed(() => {
	if (tab.value === 'pending') return 'no-pending'
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

// ─── 抽屉：详情 + 通过 / 驳回 ──────────────────────────────
const drawerVisible = ref(false)
const currentApproval = ref<ApprovalDetail | null>(null)
const approveLoading = ref(false)
const rejectLoading = ref(false)

async function openApprovalDetail(id: number) {
	currentApproval.value = null
	drawerVisible.value = true
	try {
		const res = await apiGetApproval(id)
		if (!res.success) {
			msgError(res.message || '加载审批详情失败')
			drawerVisible.value = false
			return
		}
		currentApproval.value = await buildApprovalDetail(res.data)
	} catch {
		msgError('加载审批详情失败')
		drawerVisible.value = false
	}
}

async function buildApprovalDetail(data: ApprovalFullDetailData): Promise<ApprovalDetail> {
	// 审批链：每个节点转 ChainNode
	const chain: ChainNode[] = data.nodes.map((n) => {
		let status: ChainNode['status']
		let statusText: string | undefined
		if (n.actionStatus === 2) {
			status = 'approved'
			statusText = '已通过'
		} else if (n.actionStatus === 3) {
			status = 'rejected'
			statusText = '已驳回'
		} else if (data.status === 2 && n.order === data.currentNodeOrder) {
			status = 'current'
			statusText = '审批中'
		} else {
			status = 'waiting'
			statusText = '待处理'
		}
		return {
			name: n.approverName,
			status,
			statusText,
		}
	})

	// 状态映射到抽屉三态（pending = 显示通过 / 驳回按钮）
	let drawerStatus: ApprovalDetail['status']
	if (data.status === 2) drawerStatus = 'pending'
	else if (data.status === 3) drawerStatus = 'approved'
	else drawerStatus = 'rejected'

	// 变更摘要（可选，有 prevVersion 才能调对比）
	let changes: ChangeSummaryItem[] = []
	let sizeChange: string | undefined
	if (data.prevVersion && data.versionId) {
		try {
			const cmp = await useAuthFetch<ApiResponse<CompareResult>>('/api/version/compare', {
				method: 'POST',
				body: {
					documentId: data.documentId,
					fromVersionId: data.versionId,
					toVersionId: data.prevVersion.id,
				},
			})
			if (cmp.success) {
				changes = cmp.data.summary.items.map((it) => ({
					type: it.type === 'modify' ? 'mod' : it.type,
					text: it.text,
				}))
				sizeChange = cmp.data.summary.sizeChange
			}
		} catch { /* 变更摘要失败不致命，允许留空 */ }
	}

	return {
		id: data.id,
		documentId: data.documentId,
		fileName: data.title,
		fileType: (data.ext || '').toLowerCase(),
		repo: data.groupName,
		uploader: data.initiatorName,
		uploadTime: data.uploadedAt ? formatTime(data.uploadedAt, 'YYYY-MM-DD HH:mm') : '',
		version: data.versionNo,
		prevVersion: data.prevVersion?.versionNo,
		sizeChange,
		changes,
		chain,
		status: drawerStatus,
	}
}

async function onApprove(payload: { id: number | string; opinion: string }) {
	approveLoading.value = true
	try {
		const res = await apiApproveApproval(Number(payload.id), { comment: payload.opinion || undefined })
		if (res.success) {
			msgSuccess(res.message || '已通过')
			drawerVisible.value = false
			load()
		} else {
			msgError(res.message || '通过失败')
		}
	} catch {
		msgError('通过失败')
	} finally {
		approveLoading.value = false
	}
}

async function onReject(payload: { id: number | string; opinion: string }) {
	if (!payload.opinion.trim()) {
		msgWarning('请填写驳回意见')
		return
	}
	rejectLoading.value = true
	try {
		const res = await apiRejectApproval(Number(payload.id), { comment: payload.opinion })
		if (res.success) {
			msgSuccess(res.message || '已驳回')
			drawerVisible.value = false
			load()
		} else {
			msgError(res.message || '驳回失败')
		}
	} catch {
		msgError('驳回失败')
	} finally {
		rejectLoading.value = false
	}
}

function onViewFile(approval: ApprovalDetail) {
	const docId = approval.documentId
	if (!docId) return
	drawerVisible.value = false
	navigateTo(`/docs/file/${docId}`)
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
