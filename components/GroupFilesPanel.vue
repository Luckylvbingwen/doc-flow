<template>
	<div class="gfp">
		<!-- 面包屑 -->
		<nav v-if="breadcrumb && breadcrumb.length > 0" class="gfp__breadcrumb">
			<template v-for="(item, idx) in breadcrumb" :key="idx">
				<span v-if="idx > 0" class="gfp__breadcrumb-sep">/</span>
				<a v-if="item.clickable" class="gfp__breadcrumb-link" @click="$emit('breadcrumb-click', item)">{{ item.label
				}}</a>
				<span v-else class="gfp__breadcrumb-current">{{ item.label }}</span>
			</template>
		</nav>

		<!-- 组 header -->
		<div class="gfp__header">
			<div class="gfp__header-icon">
				<el-icon :size="22">
					<FolderOpened />
				</el-icon>
			</div>
			<div class="gfp__header-info">
				<div class="gfp__title-row">
					<h3 class="gfp__title">{{ data?.name }}</h3>
					<el-button size="small" @click="$emit('group-settings')">
						<el-icon :size="13">
							<Setting />
						</el-icon>
						组设置
					</el-button>
				</div>
				<p v-if="data?.description || data?.desc" class="gfp__desc">
					{{ data.description || data.desc }}
				</p>
				<div class="gfp__header-meta">
					<span v-if="data?.ownerName || data?.owner">
						<el-icon :size="12">
							<User />
						</el-icon>
						负责人：{{ data?.ownerName || data?.owner }}
					</span>
					<span>
						<el-icon :size="12">
							<Document />
						</el-icon>
						文件数：{{ total }}
					</span>
					<span v-if="data?.createdAt">
						<el-icon :size="12">
							<Clock />
						</el-icon>
						创建于 {{ formatTime(data.createdAt, 'YYYY-MM-DD') }}
					</span>
				</div>
			</div>
		</div>

		<!-- 操作按钮条 -->
		<div class="gfp__actions">
			<el-button v-if="canCreateSubgroup" @click="$emit('create-subgroup')">
				<el-icon>
					<Plus />
				</el-icon>
				创建子组
			</el-button>
			<el-button v-if="canUpload" type="primary" @click="uploadVisible = true">
				<el-icon>
					<Upload />
				</el-icon>
				上传文件
			</el-button>
			<el-button v-if="canUpload" disabled title="飞书导入功能规划中">
				<el-icon>
					<Link />
				</el-icon>
				导入飞书
			</el-button>
		</div>

		<!-- 审批中提示条 -->
		<div v-if="reviewingCount > 0" class="gfp__banner">
			<el-icon>
				<WarningFilled />
			</el-icon>
			<span>当前有 <strong>{{ reviewingCount }}</strong> 个文件正在审批中，审批通过后会自动出现在此列表</span>
		</div>

		<!-- 子组卡片（如有） -->
		<template v-if="subgroups && subgroups.length > 0">
			<div class="gfp__section-label">
				<el-icon :size="14">
					<Folder />
				</el-icon>
				<span>子组（{{ subgroups.length }}）</span>
			</div>
			<div class="gfp__grid">
				<article v-for="g in subgroups" :key="g.id" class="gfp__card" @click="$emit('group-click', g)">
					<div class="gfp__card-head">
						<el-icon :size="16" class="gfp__card-icon">
							<Folder />
						</el-icon>
						<h5 class="gfp__card-name">{{ g.name }}</h5>
					</div>
					<p v-if="g.desc || g.description" class="gfp__card-desc">{{ g.desc || g.description }}</p>
					<div class="gfp__card-footer">
						<span v-if="g.owner || g.ownerName">
							<el-icon :size="12">
								<User />
							</el-icon>
							{{ g.owner || g.ownerName }}
						</span>
						<span>
							<el-icon :size="12">
								<Document />
							</el-icon>
							{{ g.fileCount ?? 0 }} 个文件
						</span>
					</div>
				</article>
			</div>
		</template>

		<!-- 筛选条 -->
		<div class="gfp__filter">
			<el-input
v-model="filterKeyword" placeholder="搜索文件名…" clearable size="default" class="gfp__filter-input"
				@keyup.enter="onFilterChange" @clear="onFilterChange">
				<template #prefix>
					<el-icon>
						<Search />
					</el-icon>
				</template>
			</el-input>
			<div class="gfp__section-label gfp__section-label--inline">
				<el-icon :size="14">
					<Document />
				</el-icon>
				<span>文件列表</span>
			</div>
		</div>

		<!-- 文件列表 -->
		<DataTable
ref="tableRef" v-model:page="currentPage" v-model:page-size="currentPageSize" :data="list"
			:columns="columns" :total="total" :loading="loading" :page-sizes="[10, 15, 30, 50]" empty-preset="no-docs"
			row-key="id" show-selection @page-change="onPageChange" @selection-change="onSelectionChange">
			<template #title="{ row }">
				<div class="gfp-title-cell">
					<div class="gfp-file-icon" :class="fileIconClass(row)">
						{{ (row.ext || 'FILE').toUpperCase().slice(0, 3) }}
					</div>
					<div class="gfp-title-text">
						<NuxtLink :to="`/docs/file/${row.id}`" class="gfp-title-link">{{ row.title }}</NuxtLink>
						<div v-if="row.isPinned || row.isFavorited || row.hasCustomPermissions" class="gfp-title-flags">
							<el-icon v-if="row.isPinned" title="已置顶" color="var(--df-primary)">
								<Top />
							</el-icon>
							<el-icon v-if="row.isFavorited" title="已收藏" color="#f59e0b">
								<Star />
							</el-icon>
							<el-icon v-if="row.hasCustomPermissions" title="已设置文档级权限" color="#f97316">
								<Lock />
							</el-icon>
						</div>
					</div>
				</div>
			</template>
			<template #version="{ row }">
				<span class="gfp-version">{{ row.versionNo || '—' }}</span>
			</template>
			<template #updatedAt="{ row }">
				<span class="gfp-time">{{ formatTime(row.updatedAt, 'YYYY-MM-DD HH:mm') }}</span>
			</template>
			<template #actions="{ row }">
				<div class="gfp-row-actions">
					<el-button link type="primary" @click="navigateTo(`/docs/file/${row.id}`)">详情</el-button>
					<el-dropdown trigger="click" @command="onRowCommand($event, row)">
						<el-button link type="info" class="gfp-more-btn">
							<el-icon :size="16">
								<MoreFilled />
							</el-icon>
						</el-button>
						<template #dropdown>
							<el-dropdown-menu>
								<el-dropdown-item command="download" :icon="Download">下载</el-dropdown-item>
								<el-dropdown-item :command="row.isFavorited ? 'unfavorite' : 'favorite'" :icon="Star">
									{{ row.isFavorited ? '取消收藏' : '收藏' }}
								</el-dropdown-item>
								<el-dropdown-item v-if="canPin" :command="row.isPinned ? 'unpin' : 'pin'" :icon="Top">
									{{ row.isPinned ? '取消置顶' : '置顶' }}
								</el-dropdown-item>
								<el-dropdown-item v-if="canManagePermissions" command="permissions" :icon="Lock">
									文档级权限
								</el-dropdown-item> <el-dropdown-item v-if="canMoveDoc" command="move" :icon="Rank">
									跨组移动
								</el-dropdown-item> <el-dropdown-item
v-if="canRemoveDoc" command="remove" :icon="Delete" divided
									style="color: #ef4444">
									从组移除
								</el-dropdown-item>
							</el-dropdown-menu>
						</template>
					</el-dropdown>
				</div>
			</template>
		</DataTable>

		<!-- 批量操作栅 -->
		<BulkActionBar :count="selectedRows.length" @clear="clearSelection">
			<el-button size="small" @click="onBatchDownload">
				<el-icon>
					<Download />
				</el-icon>
				批量下载
			</el-button>
			<el-button
v-if="canRemoveDoc" size="small" type="danger" plain :loading="batchRemoveLoading"
				@click="onBatchRemove">
				<el-icon>
					<Delete />
				</el-icon>
				批量移除
			</el-button>
		</BulkActionBar>

		<!-- 上传文件 -->
		<UploadFileModal
v-if="data?.id" v-model="uploadVisible" :group-id="Number(data.id)" mode="first"
			@success="onUploadSuccess" />

		<!-- 文档级权限弹窗 -->
		<DocPermissionModal
v-if="permModalRow && data?.id" v-model:visible="permModalVisible"
			:document-id="permModalRow.id" :file-name="permModalRow.title" :group-id="Number(data.id)"
			@saved="onPermissionsSaved" />

		<!-- 跨组移动弹窗 -->
		<MoveTargetPicker
v-if="moveRow && groupId" v-model="movePickerVisible" v-model:loading="moveLoading"
			:document-id="moveRow.id" :exclude-group-id="groupId" @confirm="onMoveConfirm" />
	</div>
</template>

<script setup lang="ts">
import {
	FolderOpened, Folder, Setting, Plus, Upload, Link, WarningFilled,
	Search, Document, User, Clock, Top, Star, Lock, MoreFilled,
	Download, Delete, Rank,
} from '@element-plus/icons-vue'
import type { TableColumn } from '~/components/DataTable.vue'
import {
	apiGetDocuments,
	apiRemoveDocument,
	apiDownloadDocumentUrl,
	apiFavoriteDocument,
	apiUnfavoriteDocument,
	apiPinDocument,
	apiUnpinDocument,
	apiBatchRemoveDocuments,
	apiRequestCrossMove,
} from '~/api/documents'
import type { DocumentListItem } from '~/types/document'
import type { DocumentListQuery } from '~/server/schemas/document'
import type { ApiResult, PaginatedData } from '~/types/api'
import { formatTime } from '~/utils/format'

interface BreadcrumbItem {
	label: string
	clickable?: boolean
	type?: string
	id?: number | string
}

const props = defineProps<{
	/** 当前组的完整数据（含 id / name / description / ownerName / fileCount / createdAt） */
	data?: any
	/** 子组列表（来自树节点 children 或 API 反查） */
	subgroups?: any[]
	/** 面包屑（由父级 buildBreadcrumb 计算） */
	breadcrumb?: BreadcrumbItem[]
}>()

const emit = defineEmits<{
	'group-settings': []
	'create-subgroup': []
	'group-click': [group: any]
	'breadcrumb-click': [item: BreadcrumbItem]
	'documents-changed': []  // 文件列表发生变化（上传/移除/置顶/收藏/权限），父级如需同步树 fileCount 自取
}>()

const { can } = useAuth()
const canRemoveDoc = computed(() => can('doc:remove'))
const canMoveDoc = computed(() => can('doc:move'))

// ── 列表 + 组级权限标志 ──
const reviewingCount = ref(0)
const canPin = ref(false)
const canManagePermissions = ref(false)
const canCreateSubgroup = ref(false)
const canUpload = ref(false)

const filterKeyword = ref('')

const groupId = computed<number | null>(() => {
	const id = props.data?.id
	if (id == null) return null
	const n = Number(id)
	return Number.isNaN(n) ? null : n
})

function fetchListWithFlags(
	params: DocumentListQuery,
): Promise<ApiResult<PaginatedData<DocumentListItem>>> {
	return apiGetDocuments(params).then((res) => {
		if (res.success) {
			reviewingCount.value = res.data.reviewingCount
			canPin.value = res.data.canPin
			canManagePermissions.value = res.data.canManagePermissions
			canCreateSubgroup.value = res.data.canCreateSubgroup
			canUpload.value = res.data.canUpload
		}
		return res
	})
}

const columns: TableColumn[] = [
	{ label: '文件名', slot: 'title', minWidth: 280 },
	{ label: '版本', slot: 'version', width: 100 },
	{ prop: 'ownerName', label: '归属人', width: 120 },
	{ label: '更新时间', slot: 'updatedAt', width: 160 },
	{ label: '操作', slot: 'actions', width: 160, fixed: 'right' },
]

const {
	page: currentPage,
	pageSize: currentPageSize,
	list,
	total,
	loading,
	refresh,
	onFilterChange,
	onPageChange,
} = useListPage<DocumentListItem, DocumentListQuery>({
	fetchFn: fetchListWithFlags,
	immediate: false,
	buildQuery: ({ page, pageSize }) => ({
		groupId: groupId.value!,
		status: 4,
		keyword: filterKeyword.value || undefined,
		page,
		pageSize,
	}),
})

// 切换组时刷新列表 + 重置筛选
watch(groupId, (val) => {
	if (val == null) {
		list.value = []
		total.value = 0
		return
	}
	filterKeyword.value = ''
	currentPage.value = 1
	refresh()
}, { immediate: true })

// ── 上传 ──
const uploadVisible = ref(false)
function onUploadSuccess() {
	refresh()
	emit('documents-changed')
}

// ── 行操作 ──
function fileIconClass(row: DocumentListItem): string {
	const e = (row.ext || '').toLowerCase()
	if (e === 'md') return 'is-md'
	if (e === 'pdf') return 'is-pdf'
	if (e === 'docx' || e === 'doc') return 'is-word'
	if (e === 'xlsx' || e === 'xls') return 'is-excel'
	return 'is-other'
}

async function onRowCommand(cmd: string | number | object, row: DocumentListItem) {
	if (cmd === 'download') {
		window.location.href = apiDownloadDocumentUrl(row.id)
	} else if (cmd === 'remove') {
		await onRemove(row)
	} else if (cmd === 'favorite' || cmd === 'unfavorite') {
		await onToggleFavorite(row)
	} else if (cmd === 'pin' || cmd === 'unpin') {
		await onTogglePin(row)
	} else if (cmd === 'permissions') {
		openPermissionModal(row)
	} else if (cmd === 'move') {
		openMovePicker(row)
	}
}

const favPendingIds = new Set<number>()
const pinPendingIds = new Set<number>()

async function onToggleFavorite(row: DocumentListItem) {
	if (favPendingIds.has(row.id)) return
	favPendingIds.add(row.id)
	const orig = row.isFavorited
	row.isFavorited = !orig
	try {
		const res = orig ? await apiUnfavoriteDocument(row.id) : await apiFavoriteDocument(row.id)
		if (!res.success) {
			row.isFavorited = orig
			msgError(res.message || '操作失败')
			return
		}
		row.isFavorited = res.data.isFavorited
		msgSuccess(res.message || (orig ? '已取消收藏' : '已收藏'))
	} catch {
		row.isFavorited = orig
		msgError('操作失败，请重试')
	} finally {
		favPendingIds.delete(row.id)
	}
}

async function onTogglePin(row: DocumentListItem) {
	if (pinPendingIds.has(row.id)) return
	pinPendingIds.add(row.id)
	const orig = row.isPinned
	row.isPinned = !orig
	try {
		const res = orig ? await apiUnpinDocument(row.id) : await apiPinDocument(row.id)
		if (!res.success) {
			row.isPinned = orig
			msgError(res.message || '操作失败')
			return
		}
		row.isPinned = res.data.isPinned
		msgSuccess(res.message || (orig ? '已取消置顶' : '已置顶'))
		refresh()
	} catch {
		row.isPinned = orig
		msgError('操作失败，请重试')
	} finally {
		pinPendingIds.delete(row.id)
	}
}

async function onRemove(row: DocumentListItem) {
	const ok = await msgConfirm(
		`从组移除后，文件「${row.title}」将退回归属人 ${row.ownerName} 的个人中心（可被恢复）。`,
		'确认移除',
		{ type: 'warning', confirmText: '确认移除', danger: true },
	)
	if (!ok) return
	try {
		const res = await apiRemoveDocument(row.id)
		if (res.success) {
			msgSuccess(res.message || '已从组移除')
			refresh()
			emit('documents-changed')
		} else {
			msgError(res.message || '移除失败')
		}
	} catch {
		msgError('移除失败')
	}
}

// ── 文档级权限弹窗 ──
const permModalVisible = ref(false)
const permModalRow = ref<DocumentListItem | null>(null)

function openPermissionModal(row: DocumentListItem) {
	permModalRow.value = row
	permModalVisible.value = true
}

function onPermissionsSaved() {
	refresh()
}

// ── 批量操作 ──
const tableRef = ref<{ clearSelection: () => void } | null>(null)
const selectedRows = ref<DocumentListItem[]>([])
const batchRemoveLoading = ref(false)

function onSelectionChange(selection: any[]) {
	selectedRows.value = selection as DocumentListItem[]
}

function clearSelection() {
	selectedRows.value = []
	tableRef.value?.clearSelection()
}

function onBatchDownload() {
	for (const row of selectedRows.value) {
		window.open(apiDownloadDocumentUrl(row.id), '_blank')
	}
}

async function onBatchRemove() {
	const count = selectedRows.value.length
	const confirmed = await msgConfirm(
		`确定将选中的 ${count} 个文件从组移除？移除后将退回各归属人的个人中心。`,
		'批量移除',
		{ type: 'warning', confirmText: '确认移除', danger: true },
	)
	if (!confirmed) return
	batchRemoveLoading.value = true
	try {
		const ids = selectedRows.value.map(r => r.id)
		const res = await apiBatchRemoveDocuments(ids)
		if (res.success) {
			const msg = res.message || `已移除 ${res.data.removedCount} 个文件`
			msgSuccess(msg)
			clearSelection()
			refresh()
			emit('documents-changed')
		} else {
			msgError(res.message || '批量移除失败')
		}
	} catch {
		msgError('批量移除失败')
	} finally {
		batchRemoveLoading.value = false
	}
}

// ── 跨组移动 ──
const movePickerVisible = ref(false)
const moveLoading = ref(false)
const moveRow = ref<DocumentListItem | null>(null)

function openMovePicker(row: DocumentListItem) {
	moveRow.value = row
	movePickerVisible.value = true
}

async function onMoveConfirm(targetGroupId: number) {
	if (!moveRow.value) return
	moveLoading.value = true
	try {
		const res = await apiRequestCrossMove(moveRow.value.id, targetGroupId)
		if (res.success) {
			msgSuccess(res.message || '移动请求已发起')
			movePickerVisible.value = false
			refresh()
		} else {
			msgError(res.message || '发起移动失败')
		}
	} catch {
		msgError('发起移动失败')
	} finally {
		moveLoading.value = false
	}
}
</script>

<style lang="scss" scoped>
.gfp {
	padding: 24px;
	display: flex;
	flex-direction: column;
	min-height: 100%;
}

.gfp__breadcrumb {
	display: flex;
	align-items: center;
	gap: 6px;
	font-size: 13px;
	color: var(--df-subtext);
	margin-bottom: 12px;
}

.gfp__breadcrumb-sep {
	color: var(--df-border);
}

.gfp__breadcrumb-link {
	color: var(--df-primary);
	cursor: pointer;
	transition: opacity 0.15s;

	&:hover {
		opacity: 0.8;
	}
}

.gfp__breadcrumb-current {
	color: var(--df-text);
}

.gfp__header {
	display: flex;
	align-items: flex-start;
	gap: 14px;
	margin-bottom: 20px;
}

.gfp__header-icon {
	width: 44px;
	height: 44px;
	border-radius: 10px;
	background: color-mix(in srgb, #f59e0b 12%, transparent);
	color: #f59e0b;
	display: flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
}

.gfp__header-info {
	flex: 1;
	min-width: 0;
}

.gfp__title-row {
	display: flex;
	align-items: center;
	gap: 10px;
}

.gfp__title {
	font-size: 18px;
	font-weight: 700;
	color: var(--df-text);
	margin: 0 0 4px;
	line-height: 1.4;
}

.gfp__desc {
	font-size: 13px;
	color: var(--df-subtext);
	margin: 0 0 6px;
	line-height: 1.5;
}

.gfp__header-meta {
	display: flex;
	flex-wrap: wrap;
	gap: 16px;
	font-size: 12px;
	color: var(--df-subtext);
	margin-top: 6px;

	span {
		display: inline-flex;
		align-items: center;
		gap: 4px;

		.el-icon {
			opacity: 0.7;
		}
	}
}

.gfp__actions {
	display: flex;
	align-items: center;
	gap: 8px;
	margin-bottom: 16px;
}

.gfp__banner {
	display: flex;
	align-items: center;
	gap: 8px;
	padding: 10px 14px;
	margin-bottom: 16px;
	background: #fffbeb;
	border: 1px solid #fde68a;
	border-radius: 8px;
	color: #92400e;
	font-size: 13px;

	.el-icon {
		color: #f59e0b;
	}
}

.gfp__section-label {
	display: flex;
	align-items: center;
	gap: 6px;
	font-size: 13px;
	font-weight: 600;
	color: var(--df-subtext);
	margin-bottom: 12px;
	padding-bottom: 8px;
	border-bottom: 1px solid var(--df-border);

	.el-icon {
		color: #f59e0b;
	}

	&--inline {
		flex: 1;
		margin-bottom: 0;
		padding-bottom: 0;
		border-bottom: none;
	}
}

.gfp__grid {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
	gap: 12px;
	margin-bottom: 24px;
}

.gfp__card {
	padding: 14px 16px;
	background: var(--df-surface);
	border: 1px solid var(--df-border);
	border-radius: 10px;
	cursor: pointer;
	transition: border-color 0.2s, box-shadow 0.2s, transform 0.15s;

	&:hover {
		border-color: var(--df-primary);
		box-shadow: 0 2px 12px rgb(0 0 0 / 0.06);
		transform: translateY(-1px);
	}
}

.gfp__card-head {
	display: flex;
	align-items: center;
	gap: 8px;
	margin-bottom: 6px;
}

.gfp__card-icon {
	color: #f59e0b;
	flex-shrink: 0;
}

.gfp__card-name {
	font-size: 14px;
	font-weight: 600;
	color: var(--df-text);
	margin: 0;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.gfp__card-desc {
	font-size: 12px;
	color: var(--df-subtext);
	margin: 0 0 10px;
	line-height: 1.5;
	display: -webkit-box;
	-webkit-line-clamp: 2;
	line-clamp: 2;
	-webkit-box-orient: vertical;
	overflow: hidden;
}

.gfp__card-footer {
	display: flex;
	align-items: center;
	gap: 14px;

	span {
		display: inline-flex;
		align-items: center;
		gap: 3px;
		font-size: 12px;
		color: var(--df-subtext);
	}
}

.gfp__filter {
	display: flex;
	align-items: center;
	gap: 12px;
	margin-bottom: 12px;
	padding-bottom: 8px;
	border-bottom: 1px solid var(--df-border);
}

.gfp__filter-input {
	width: 280px;
	flex-shrink: 0;
}

.gfp-title-cell {
	display: flex;
	align-items: center;
	gap: 10px;
}

.gfp-file-icon {
	flex-shrink: 0;
	width: 36px;
	height: 36px;
	border-radius: 8px;
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 11px;
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

.gfp-title-text {
	display: flex;
	align-items: center;
	gap: 6px;
	min-width: 0;
}

.gfp-title-link {
	color: var(--df-text);
	text-decoration: none;
	font-weight: 500;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;

	&:hover {
		color: var(--df-primary);
	}
}

.gfp-title-flags {
	display: inline-flex;
	gap: 4px;
	flex-shrink: 0;

	.el-icon {
		font-size: 14px;
	}
}

.gfp-version {
	color: var(--df-primary);
	font-variant-numeric: tabular-nums;
}

.gfp-time {
	font-size: 12px;
	color: var(--df-subtext);
}

.gfp-row-actions {
	display: flex;
	align-items: center;
	gap: 4px;
}

.gfp-more-btn {
	padding: 4px;
	border-radius: 4px;
	transition: background 0.15s;

	&:hover {
		background: var(--el-fill-color-light);
	}
}
</style>
