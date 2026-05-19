<template>
	<ListPageShell>
		<template #header>
			<PageTitle title="个人中心" subtitle="我创建的、分享给我的、个人收藏、离职交接" :refreshing="loading" @refresh="load">
				<template #actions>
					<el-button type="primary" size="small" @click="handleNewDoc">
						<el-icon>
							<Plus />
						</el-icon>
						新建文档
					</el-button>
				</template>
			</PageTitle>
		</template>

		<template #filter>
			<div class="profile-toolbar">
				<TabBar v-model="tab" :tabs="tabs" @update:model-value="onTabChange" />
				<FilterBar v-if="statusFilterEnabled" :clear-count="activeFilterCount" @clear="onResetFilter">
					<div class="df-filter-item">
						<label class="df-filter-label">状态</label>
						<el-select
v-model="filterStatus" placeholder="全部状态" clearable @change="onFilterChange"
							@clear="onFilterChange">
							<el-option v-for="opt in statusOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
						</el-select>
					</div>
					<div class="df-filter-item">
						<label class="df-filter-label">关键词</label>
						<el-input
v-model="filterKeyword" placeholder="搜索文件名..." clearable @keyup.enter="onFilterChange"
							@clear="onFilterChange">
							<template #prefix>
								<el-icon>
									<Search />
								</el-icon>
							</template>
						</el-input>
					</div>
				</FilterBar>
			</div>
		</template>

		<!-- 离职移交：手风琴视图 -->
		<div v-if="tab === 'handover'" class="profile-handover-body">
			<el-scrollbar>
				<div class="profile-handover-inner">
					<EmptyState v-if="handoverForbidden" preset="no-content" title="无权访问" description="离职交接仅部门负责人可见" />
					<HandoverAccordion
v-else-if="!loading" :groups="handoverGroups" @view="onView" @download="onDownload"
						@delete="onDelete" />
				</div>
			</el-scrollbar>
		</div>

		<!-- 普通 Tab：DataTable -->
		<DataTable
v-else v-model:page="page" v-model:page-size="pageSize" :data="list" :columns="columns" :total="total"
			:loading="loading" :page-sizes="[10, 15, 30, 50]" :empty-preset="emptyPreset" row-key="id" fill-height
			:action-width="260" @page-change="onPageChange">
			<template #title="{ row }">
				<NuxtLink class="profile-title" :to="getDocLink(row)">
					<div class="profile-file-icon" :class="getFileTypeClass(row.ext)">
						{{ getFileTypeLabel(row.ext) }}
					</div>
					<span class="profile-title-name" :title="row.title">{{ row.title }}</span>
					<ElIcon v-if="tab === 'favorite' || row.source === 'favorite'" class="profile-star-icon">
						<StarFilled />
					</ElIcon>
				</NuxtLink>
			</template>
			<template #source="{ row }">
				<span v-if="tab === 'all'" class="profile-source">
					<span
class="profile-source-badge"
						:style="{ color: getItemSourceMeta(row.source).color, background: getItemSourceMeta(row.source).bg }">
						{{ getItemSourceMeta(row.source).label }}
					</span>
					<span
v-if="row.source === 'shared' && row.permissionLevel" class="profile-source-badge"
						:style="{ color: getPermissionLevelMeta(row.permissionLevel).color, background: getPermissionLevelMeta(row.permissionLevel).bg }">
						{{ getPermissionLevelMeta(row.permissionLevel).label }}
					</span>
				</span>
				<span
v-else-if="tab === 'shared' && row.permissionLevel" class="profile-source-badge"
					:style="{ color: getPermissionLevelMeta(row.permissionLevel).color, background: getPermissionLevelMeta(row.permissionLevel).bg }">
					{{ getPermissionLevelMeta(row.permissionLevel).label }}
				</span>
				<span v-else class="profile-muted">—</span>
			</template>
			<template #status="{ row }">
				<span
class="profile-status-badge"
					:style="{ color: getDocStatusMeta(row.status).color, background: getDocStatusMeta(row.status).bg }">
					{{ getDocStatusMeta(row.status).label }}
				</span>
			</template>
			<template #updatedAt="{ row }">
				<span class="profile-time">{{ formatTime(row.updatedAt, 'YYYY-MM-DD HH:mm') }}</span>
			</template>
			<template #action="{ row }">
				<template v-for="act in getRowPrimaryActions(row)" :key="act.kind">
					<el-button
:type="act.type === 'default' ? '' : act.type" text size="small"
						:loading="busyId === row.id && busyKind === act.kind" :disabled="busyId != null && busyId !== row.id"
						@click="onActionClick(row, act.kind)">
						{{ act.label }}
					</el-button>
				</template>
				<el-dropdown
v-if="getRowMenuActions(row).length" trigger="click"
					@command="(cmd: ActionKind) => onActionClick(row, cmd)">
					<el-button text size="small" :disabled="busyId != null && busyId !== row.id">
						···
					</el-button>
					<template #dropdown>
						<el-dropdown-menu>
							<el-dropdown-item
v-for="act in getRowMenuActions(row)" :key="act.kind" :command="act.kind"
								:style="act.type === 'danger' ? { color: 'var(--el-color-danger)' } : {}">
								{{ act.label }}
							</el-dropdown-item>
						</el-dropdown-menu>
					</template>
				</el-dropdown>
			</template>
		</DataTable>

		<!-- 分享链接弹窗 -->
		<ShareLinkModal
v-if="shareTarget" v-model="shareModalVisible" :document-id="shareTarget.id"
			:file-name="`${shareTarget.title}.${shareTarget.ext || 'md'}`" :can-edit="true" />

		<!-- 提交发布弹窗 -->
		<PublishModal v-model="publishModalVisible" :doc="publishTarget" @success="load" />

		<!-- 转移归属人弹窗 -->
		<OwnershipTransferModal
v-if="transferTarget" v-model="transferModalVisible" :document-id="transferTarget.id"
			:document-title="transferTarget.title" :exclude-user-id="currentUserId" @success="onTransferSuccess" />
	</ListPageShell>
</template>

<script setup lang="ts">
import { Search, Plus, StarFilled } from '@element-plus/icons-vue'
import type { TableColumn } from '~/components/DataTable.vue'
import { formatTime } from '~/utils/format'
import { getFileTypeClass, getFileTypeLabel } from '~/utils/file-type'
import {
	getDocStatusMeta,
	getItemSourceMeta,
	getPermissionLevelMeta,
} from '~/utils/doc-meta'
import { primaryActions, menuActions, type ActionKind } from '~/utils/personal-matrix'
import { apiGetPersonalDocs, apiGetPersonalHandover, apiDeleteDraft } from '~/api/personal'
import { apiDownloadDocument, apiSubmitPermissionRequest, apiUnfavoriteDocument, apiGetDocumentApprovals } from '~/api/documents'
import { apiCreateDraft, apiCreateEditCopy, apiGetAnnotations } from '~/api/document-editor'
import { apiWithdrawApproval } from '~/api/approvals'
import type {
	PersonalDocItem,
	HandoverGroup,
	PersonalTab,
	PersonalListQuery,
} from '~/types/personal'

definePageMeta({
	layout: 'prototype',
	fixedLayout: true,
})
useHead({ title: '个人中心 - DocFlow' })

const authStore = useAuthStore()
const currentUserId = computed(() => authStore.user?.id ?? 0)

// 「离职移交」Tab 严格按 PRD §6.5.2 「仅部门负责人可见」—— 非 dept_head 用户不展示
const { hasRole } = useAuth()
const canViewHandover = computed(() => hasRole(['dept_head', 'super_admin']))

const tabCounts = reactive<Record<PersonalTab, number | undefined>>({
	all: undefined,
	mine: undefined,
	shared: undefined,
	favorite: undefined,
	handover: undefined,
})

const allTabs: Array<{ value: PersonalTab; label: string; badge?: string }> = [
	{ value: 'all', label: '全部' },
	{ value: 'mine', label: '我创建的' },
	{ value: 'shared', label: '分享给我的' },
	{ value: 'favorite', label: '个人收藏' },
	{ value: 'handover', label: '离职移交', badge: 'NEW' },
]
const tabs = computed(() =>
	allTabs
		.filter(t => t.value !== 'handover' || canViewHandover.value)
		.map(t => ({ ...t, count: tabCounts[t.value] })),
)

const tab = ref<PersonalTab>('all')

// 无权访问离职移交却当前选中 → 回退到"全部"
watch(canViewHandover, (can) => {
	if (!can && tab.value === 'handover') {
		tab.value = 'all'
		load()
	}
}, { immediate: true })
const filterStatus = ref<1 | 2 | 3 | 4 | null>(null)
const filterKeyword = ref('')

// 关键词实时防抖过滤
let keywordDebounce: ReturnType<typeof setTimeout>
watch(filterKeyword, () => {
	clearTimeout(keywordDebounce)
	keywordDebounce = setTimeout(() => onFilterChange(), 300)
})

// handover 特殊状态
const handoverGroups = ref<HandoverGroup[]>([])
const handoverForbidden = ref(false)

// handover tab 下不显示状态筛选
const statusFilterEnabled = computed(() => tab.value !== 'handover')

const activeFilterCount = computed(() => {
	let n = 0
	if (filterStatus.value != null) n++
	if (filterKeyword.value) n++
	return n
})

const statusOptions: Array<{ label: string; value: 1 | 2 | 3 | 4 }> = [
	{ value: 1, label: '草稿' },
	{ value: 2, label: '编辑中' },
	{ value: 3, label: '审批中' },
	{ value: 4, label: '已发布' },
]

const emptyPreset = computed(() => {
	if (filterStatus.value != null || filterKeyword.value) return 'no-results'
	if (tab.value === 'mine') return 'no-files'
	if (tab.value === 'shared') return 'no-files'
	if (tab.value === 'favorite') return 'no-files'
	return 'no-content'
})

const columns = computed<TableColumn[]>(() => {
	const base: TableColumn[] = [
		{ label: '文件名', slot: 'title', minWidth: 260 },
		{ label: '来源', slot: 'source', minWidth: 120 },
		{ prop: 'versionNo', label: '版本', width: 80, align: 'center' },
		{ prop: 'ownerName', label: '创建人', minWidth: 100 },
		{ label: '状态', slot: 'status', width: 100, align: 'center' },
		{ prop: 'groupName', label: '所属组', minWidth: 120 },
		{ label: '更新时间', slot: 'updatedAt', width: 170 },
	]
	// 子 Tab 不显示来源列
	if (tab.value !== 'all') return base.filter(c => c.label !== '来源')
	return base
})

/** PRD: 文件名可点击跳转（草稿/编辑中→编辑器，其他→详情页） */
function getDocLink(row: PersonalDocItem): string {
	if ((row.status === 1 || row.status === 2) && row.docType === 2) {
		return `/docs/editor/${row.id}?from=personal`
	}
	return `/docs/file/${row.id}`
}

// 加载操作态
const busyId = ref<number | null>(null)
const busyKind = ref<ActionKind | null>(null)

// ── 非 handover tab：走 useListPage ──
const {
	page,
	pageSize,
	list,
	total,
	loading: listLoading,
	refresh: refetchList,
	onFilterChange: triggerListRefetch,
	onPageChange,
} = useListPage<PersonalDocItem, Omit<PersonalListQuery, 'tab'> & { tab: 'all' | 'mine' | 'shared' | 'favorite' }>({
	fetchFn: async (params) => {
		const res = await apiGetPersonalDocs(params)
		if (res.success) {
			tabCounts.all = res.data.tabCounts.all
			tabCounts.mine = res.data.tabCounts.mine
			tabCounts.shared = res.data.tabCounts.shared
			tabCounts.favorite = res.data.tabCounts.favorite
		}
		return res
	},
	buildQuery: ({ page, pageSize }) => ({
		tab: tab.value === 'handover' ? 'all' : tab.value,
		status: statusFilterEnabled.value ? (filterStatus.value ?? undefined) : undefined,
		keyword: filterKeyword.value || undefined,
		page,
		pageSize,
	}),
	resetFilters: () => {
		filterStatus.value = null
		filterKeyword.value = ''
	},
	immediate: false, // 首次加载由 onMounted 分发到对应分支
})

// ── handover tab：单独拉取 ──
const handoverLoading = ref(false)
async function refetchHandover() {
	handoverLoading.value = true
	handoverForbidden.value = false
	try {
		const res = await apiGetPersonalHandover({
			keyword: filterKeyword.value || undefined,
			page: 1,
			pageSize: 100, // 离职人员数量有限，一次拿全
		})
		if (res.success) {
			handoverGroups.value = res.data.list
			// handover 响应也带 tabCounts
			tabCounts.all = res.data.tabCounts.all
			tabCounts.mine = res.data.tabCounts.mine
			tabCounts.shared = res.data.tabCounts.shared
			tabCounts.favorite = res.data.tabCounts.favorite
		} else if (res.code === 'HANDOVER_NOT_DEPT_HEAD') {
			handoverForbidden.value = true
			handoverGroups.value = []
		} else {
			msgError(res.message || '加载失败')
			handoverGroups.value = []
		}
	} catch {
		msgError('加载失败')
		handoverGroups.value = []
	} finally {
		handoverLoading.value = false
	}
}

// 对外统一的 loading / refresh 入口
const loading = computed(() => (tab.value === 'handover' ? handoverLoading.value : listLoading.value))
function load() {
	if (tab.value === 'handover') refetchHandover()
	else refetchList()
}

function onFilterChange() {
	if (tab.value === 'handover') refetchHandover()
	else triggerListRefetch()
}

function onResetFilter() {
	filterStatus.value = null
	filterKeyword.value = ''
	if (tab.value === 'handover') refetchHandover()
	else triggerListRefetch()
}

function onTabChange() {
	filterStatus.value = null
	filterKeyword.value = ''
	handoverGroups.value = []
	handoverForbidden.value = false
	load()
}

onMounted(load)

// ── 新建文档 ──
async function handleNewDoc() {
	const res = await apiCreateDraft({ title: '未命名文档' })
	if (res.success) {
		await navigateTo(`/docs/editor/${res.data.id}?from=personal`)
	}
}

// ── 行操作 ──
function getRowPrimaryActions(doc: PersonalDocItem) {
	return primaryActions(doc, currentUserId.value)
}

function getRowMenuActions(doc: PersonalDocItem) {
	return menuActions(doc, currentUserId.value)
}

function onView(doc: PersonalDocItem) {
	navigateTo(`/docs/file/${doc.id}`)
}

async function onActionClick(doc: PersonalDocItem, kind: ActionKind) {
	if (kind === 'view') return onView(doc)
	if (kind === 'download') return onDownload(doc)
	if (kind === 'share') return onShare(doc)
	if (kind === 'publish') return onPublish(doc)
	if (kind === 'withdraw') return onWithdraw(doc)
	if (kind === 'delete') return onDelete(doc)
	if (kind === 'transfer') return onTransfer(doc)
	if (kind === 'requestEdit') return onRequestEdit(doc)
	if (kind === 'edit') return onEdit(doc)
	if (kind === 'unfavorite') return onUnfavorite(doc)
}

async function onEdit(doc: PersonalDocItem) {
	// 草稿/编辑中/已驳回 → 直接进编辑器
	if (doc.status === 1 || doc.status === 2 || doc.status === 5) {
		await navigateTo(`/docs/editor/${doc.id}?from=personal`)
		return
	}
	// 已发布 → 前置确认 + 编辑副本流程
	if (doc.status === 4 && (doc.source === 'mine' || tab.value === 'mine')) {
		// 检查是否有未解决的批注
		let annotationHint = ''
		const annoRes = await apiGetAnnotations(doc.id)
		if (annoRes.success && annoRes.data) {
			const unresolvedCount = annoRes.data.filter(a => a.status !== 2).length
			if (unresolvedCount > 0) {
				annotationHint = `\n⚠️ 当前有 ${unresolvedCount} 条未解决批注，创建编辑副本后批注将被冻结。`
			}
		}
		const confirmed = await msgConfirm(
			`即将创建文件《${doc.title}》(${doc.versionNo}) 的编辑副本，原文件在编辑期间保持已发布状态不变。${annotationHint}`,
			'创建编辑副本',
			{ confirmText: '确认创建', type: 'warning' },
		)
		if (!confirmed) return
	}
	busyId.value = doc.id
	busyKind.value = 'edit'
	try {
		const res = await apiCreateEditCopy(doc.id)
		if (!res.success) {
			msgError(res.message || '创建编辑副本失败')
			return
		}
		if (res.data.isNew) {
			await navigateTo(`/docs/editor/${res.data.id}?from=personal`)
			return
		}
		const isSelf = res.data.ownerUserId === currentUserId.value
		if (isSelf) {
			await navigateTo(`/docs/editor/${res.data.id}?from=personal`)
			return
		}
		const confirmed = await msgConfirm(
			`${res.data.ownerName} 正在编辑该文档，是否加入协同编辑？`,
			'加入协同编辑',
			{ confirmText: '加入协同', type: 'info' },
		)
		if (confirmed) {
			await navigateTo(`/docs/editor/${res.data.id}?from=personal`)
		}
	} finally {
		busyId.value = null
		busyKind.value = null
	}
}

async function onDownload(doc: PersonalDocItem) {
	const res = await apiDownloadDocument(doc.id)
	if (res.success && res.data) window.location.href = res.data.url
}

// ── 分享 ──
const shareModalVisible = ref(false)
const shareTarget = ref<PersonalDocItem | null>(null)

function onShare(doc: PersonalDocItem) {
	shareTarget.value = doc
	shareModalVisible.value = true
}

// ── 转移归属人 ──
const transferModalVisible = ref(false)
const transferTarget = ref<PersonalDocItem | null>(null)

function onTransfer(doc: PersonalDocItem) {
	transferTarget.value = doc
	transferModalVisible.value = true
}

function onTransferSuccess() {
	load()
}

// ── 取消收藏 ──
async function onUnfavorite(doc: PersonalDocItem) {
	busyId.value = doc.id
	busyKind.value = 'unfavorite'
	try {
		const res = await apiUnfavoriteDocument(doc.id)
		if (res.success) {
			msgSuccess(res.message || '已取消收藏')
			load()
		} else {
			msgError(res.message || '取消收藏失败')
		}
	} catch {
		msgError('取消收藏失败')
	} finally {
		busyId.value = null
		busyKind.value = null
	}
}

// ── 申请编辑权限 ──
async function onRequestEdit(doc: PersonalDocItem) {
	busyId.value = doc.id
	busyKind.value = 'requestEdit'
	try {
		const res = await apiSubmitPermissionRequest(doc.id, { type: 2 })
		if (res.success) {
			msgSuccess(res.message || '申请已发送')
			load()
		} else {
			msgError(res.message || '申请失败')
		}
	} catch {
		msgError('申请失败')
	} finally {
		busyId.value = null
		busyKind.value = null
	}
}

// ── 提交发布 ──
const publishModalVisible = ref(false)
const publishTarget = ref<PersonalDocItem | null>(null)

function onPublish(doc: PersonalDocItem) {
	publishTarget.value = doc
	publishModalVisible.value = true
}

async function onWithdraw(doc: PersonalDocItem) {
	const ok = await msgConfirm(
		`确定撤回「${doc.title}」的审批吗？撤回后文档将回到编辑中状态。`,
		'撤回审批',
		{ type: 'warning', confirmText: '确认撤回', danger: true },
	)
	if (!ok) return
	busyId.value = doc.id
	busyKind.value = 'withdraw'
	try {
		// 查找该文档的活跃审批实例
		const appRes = await apiGetDocumentApprovals(doc.id)
		if (!appRes.success) {
			msgError(appRes.message || '获取审批信息失败')
			return
		}
		const activeInstance = appRes.data.find(a => a.status === 2)
		if (!activeInstance) {
			msgWarning('未找到进行中的审批实例')
			return
		}
		const res = await apiWithdrawApproval(activeInstance.id)
		if (res.success) {
			msgSuccess(res.message || '撤回成功')
			load()
		} else {
			msgError(res.message || '撤回失败')
		}
	} catch {
		msgError('撤回失败')
	} finally {
		busyId.value = null
		busyKind.value = null
	}
}

async function onDelete(doc: PersonalDocItem) {
	const ok = await msgConfirm(
		`确定删除「${doc.title}」？草稿将进入个人回收站，30 天内可恢复。`,
		'删除草稿',
		{ type: 'warning', confirmText: '删除', danger: true },
	)
	if (!ok) return
	busyId.value = doc.id
	busyKind.value = 'delete'
	try {
		const res = await apiDeleteDraft(doc.id)
		if (res.success) {
			msgSuccess(res.message || '已进入个人回收站，30天内可恢复')
			load()
		} else {
			msgError(res.message || '删除失败')
		}
	} catch {
		msgError('删除失败')
	} finally {
		busyId.value = null
		busyKind.value = null
	}
}
</script>

<style lang="scss" scoped>
.profile-toolbar {
	display: flex;
	flex-direction: column;
	gap: 12px;
}

.profile-handover-body {
	flex: 1;
	min-height: 0;
}

.profile-handover-inner {
	padding: 4px 12px 4px 0;
}

.profile-title {
	display: flex;
	align-items: center;
	gap: 10px;
	min-width: 0;
	text-decoration: none;
	color: inherit;
}

.profile-file-icon {
	flex-shrink: 0;
	width: 32px;
	height: 32px;
	border-radius: 6px;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	font-size: 10px;
	font-weight: 600;
	color: #fff;
	background: #94a3b8;

	&.is-pdf {
		background: #ef4444;
	}

	&.is-word {
		background: #2563eb;
	}

	&.is-excel {
		background: #10b981;
	}

	&.is-md {
		background: #8b5cf6;
	}
}

.profile-title-name {
	color: var(--df-text);
	font-weight: 500;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
	cursor: pointer;

	&:hover {
		color: var(--df-primary);
	}
}

.profile-star-icon {
	color: #f5a623;
	font-size: 14px;
	flex-shrink: 0;
	margin-left: 4px;
}

.profile-source {
	display: inline-flex;
	align-items: center;
	gap: 4px;
	flex-wrap: wrap;
}

.profile-source-badge,
.profile-status-badge {
	display: inline-flex;
	align-items: center;
	padding: 2px 8px;
	border-radius: 10px;
	font-size: 12px;
	font-weight: 500;
	line-height: 1.5;
}

.profile-time {
	color: var(--df-subtext);
	font-size: 12px;
	font-variant-numeric: tabular-nums;
}

.profile-muted {
	color: var(--df-border);
}
</style>
