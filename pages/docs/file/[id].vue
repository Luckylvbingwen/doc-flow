<template>
	<section class="pf-page-stack">
		<!-- 顶栏：返回 + 文件标识 + 核心操作 + 更多菜单 -->
		<div class="df-file-topbar">
			<div class="df-file-topbar__left">
				<el-button text @click="backToGroup">
					<el-icon>
						<Back />
					</el-icon>
					{{ backLabel }}
				</el-button>
				<span class="df-file-topbar__sep" />
				<div class="df-file-icon df-file-icon--sm" :class="`df-file-icon--${fileType}`">
					{{ fileTypeAbbr }}
				</div>
				<h2 class="df-file-topbar__name">{{ fileName || '加载中...' }}</h2>
				<span v-if="detail" class="file-status" :class="`file-status--${statusKey}`">
					{{ statusText }}
				</span>
				<span v-if="currentVersion" class="df-file-topbar__ver">{{ currentVersion.versionNo }}</span>
				<el-tooltip v-if="detail?.hasCustomPermissions" content="该文档已设置文档级权限" placement="top">
					<el-icon class="df-file-info-lock" color="#f97316" :size="15">
						<Lock />
					</el-icon>
				</el-tooltip>
			</div>
			<div v-if="detail" class="df-file-topbar__right">
				<!-- 收藏 -->
				<el-tooltip :content="detail.isFavorited ? '取消收藏' : '收藏'" placement="top">
					<el-button
circle size="small" :type="detail.isFavorited ? 'warning' : 'default'" :loading="favoritePending"
						@click="onToggleFavorite">
						<el-icon>
							<StarFilled v-if="detail.isFavorited" />
							<Star v-else />
						</el-icon>
					</el-button>
				</el-tooltip>
				<!-- 置顶 -->
				<el-tooltip v-if="detail.canPin" :content="detail.isPinned ? '取消置顶' : '置顶'" placement="top">
					<el-button
circle size="small" :type="detail.isPinned ? 'primary' : 'default'" :loading="pinPending"
						@click="onTogglePin">
						<el-icon>
							<Top />
						</el-icon>
					</el-button>
				</el-tooltip>
				<span class="df-file-topbar__sep" />
				<!-- 协作者头像叠层 -->
				<AvatarStack :users="collaborators" :max="3" />
				<!-- 核心按钮：编辑/下载/分享 -->
				<el-button v-if="detail.canEdit" size="small" @click="handleEdit">
					<el-icon>
						<Edit />
					</el-icon>
					编辑
				</el-button>
				<el-button
v-if="detail.canSubmitApproval" type="primary" size="small" :loading="submitLoading"
					@click="handleSubmitApproval">
					<el-icon>
						<Promotion />
					</el-icon>
					提交审批
				</el-button>
				<el-button v-if="detail.status === 4" size="small" @click="handleDownloadCurrent">
					<el-icon>
						<Download />
					</el-icon>
					下载
				</el-button>
				<el-button v-if="detail.status === 4" size="small" @click="shareModalVisible = true">
					<el-icon>
						<Share />
					</el-icon>
					分享
				</el-button>
				<!-- 更多菜单 -->
				<el-dropdown trigger="click" placement="bottom-end" @command="handleMoreCommand">
					<el-button size="small" class="df-file-topbar__more">
						<el-icon>
							<MoreFilled />
						</el-icon>
					</el-button>
					<template #dropdown>
						<el-dropdown-menu>
							<el-dropdown-item v-if="detail.canManagePermissions" command="permission">
								<el-icon>
									<Lock />
								</el-icon>
								权限设置
							</el-dropdown-item>
							<el-dropdown-item v-if="detail.status === 4 && detail.groupId && canMove" command="move">
								<el-icon>
									<Rank />
								</el-icon>
								跨组移动
							</el-dropdown-item>
							<el-dropdown-item v-if="detail.canUploadVersion" command="upload">
								<el-icon>
									<Upload />
								</el-icon>
								上传新版本
							</el-dropdown-item>
							<el-dropdown-item command="history" divided>
								<el-icon>
									<List />
								</el-icon>
								历史记录
							</el-dropdown-item>
							<el-dropdown-item v-if="detail.canRemove" command="remove" divided>
								<span style="color: var(--el-color-danger)">
									<el-icon>
										<Delete />
									</el-icon>
									从组移除
								</span>
							</el-dropdown-item>
						</el-dropdown-menu>
					</template>
				</el-dropdown>
			</div>
		</div>

		<!-- 文件元数据条 -->
		<div v-if="detail" class="df-file-meta-bar">
			<span class="df-file-meta-bar__item">
				<span class="df-file-meta-bar__label">上传者</span>
				{{ detail.ownerName }}
			</span>
			<span class="df-file-meta-bar__item">
				<span class="df-file-meta-bar__label">更新</span>
				{{ formatTime(detail.updatedAt, 'YYYY-MM-DD') }}
			</span>
			<span v-if="detail.currentVersion" class="df-file-meta-bar__item">
				<span class="df-file-meta-bar__label">大小</span>
				{{ formatBytes(detail.currentVersion.fileSize) }}
			</span>
			<span v-if="detail.groupName" class="df-file-meta-bar__item">
				<span class="df-file-meta-bar__label">所属组</span>
				{{ detail.groupName }}
			</span>
			<span class="df-file-meta-bar__item">
				<span class="df-file-meta-bar__label">下载</span>
				<span class="df-file-meta-bar__highlight">{{ detail.downloadCount }} 次</span>
			</span>
		</div>

		<!-- 预览区 + 版本侧边栏 -->
		<div class="df-file-split">
			<div class="df-preview-pane">
				<!-- 页内对比模式条 -->
				<div v-if="inlineComparing" class="df-compare-exit">
					<el-icon>
						<Switch />
					</el-icon>
					<span>版本对比模式</span>
					<span style="font-weight: 600">
						{{ currentVersion?.versionNo }} vs {{ compareTarget?.versionNo }}
					</span>
					<el-button size="small" style="margin-left: auto" @click="exitInlineCompare">
						退出对比
					</el-button>
					<el-button size="small" type="primary" @click="openFullscreenCompare">
						<el-icon>
							<FullScreen />
						</el-icon>
						全屏对比
					</el-button>
				</div>

				<!-- 正常预览模式 -->
				<template v-if="!inlineComparing">
					<div class="df-preview-toolbar">
						<span class="preview-ver">{{ currentVersion?.versionNo || '-' }}（当前）</span>
						<span style="width: 1px; height: 14px; background: var(--df-border)" />
						<span>{{ fileTypeText }} 文档</span>
						<span style="margin-left: auto" />
						<el-button
size="small" text :disabled="previewLoading || !previewHtml"
							@click="fullscreenPreviewVisible = true">
							<el-icon>
								<FullScreen />
							</el-icon>
							全屏预览
						</el-button>
						<el-button size="small" text :disabled="!compareTarget" @click="openFullscreenCompare">
							<el-icon>
								<FullScreen />
							</el-icon>
							全屏对比
						</el-button>
					</div>
					<el-scrollbar>
						<div class="df-preview-body">
							<DocPreview :file-type="fileType" :html="previewHtml" :loading="previewLoading" />
						</div>
					</el-scrollbar>
				</template>

				<!-- 页内对比模式 -->
				<template v-else>
					<div
v-if="compareLoading"
						style="flex: 1; display: flex; align-items: center; justify-content: center; gap: 10px; color: var(--df-subtext); font-size: 13px">
						<el-icon class="is-loading" :size="24" color="var(--df-primary)">
							<Loading />
						</el-icon>
						<span>正在计算差异…</span>
					</div>
					<div v-else-if="compareResult" class="df-compare-split">
						<div class="df-compare-pane">
							<div class="cp-header">
								<span style="padding: 2px 8px; background: #fecaca; border-radius: 4px">旧版</span>
								<span>{{ compareResult.oldVersion.versionNo }}</span>
							</div>
							<el-scrollbar>
								<div class="cp-body" v-html="sanitize(compareResult.oldVersion.html)" />
							</el-scrollbar>
						</div>
						<div class="df-compare-pane">
							<div class="cp-header">
								<span style="padding: 2px 8px; background: #bbf7d0; border-radius: 4px">新版</span>
								<span>{{ compareResult.newVersion.versionNo }}</span>
							</div>
							<el-scrollbar>
								<div class="cp-body" v-html="sanitize(compareResult.newVersion.html)" />
							</el-scrollbar>
						</div>
					</div>
				</template>
			</div>

			<!-- 版本侧边栏 -->
			<VersionSidebar
:versions="versions" :can-rollback="detail?.canRollback ?? false"
				@download="handleDownloadVersion" @rollback="handleRollback" @compare="handleCompare"
				@upload="onVersionSidebarUpload" />
		</div>

		<!-- 变更摘要（仅对比时显示） -->
		<Transition name="slide-fade">
			<div v-if="compareResult && compareResult.summary" class="pf-card" style="padding: 16px">
				<h5 style="margin: 0 0 12px; font-size: 14px; display: flex; align-items: center; gap: 8px">
					<el-icon color="var(--df-primary)">
						<DataAnalysis />
					</el-icon>
					版本变更摘要
					<span style="font-size: 12px; font-weight: 400; color: var(--df-subtext)">
						{{ compareResult.newVersion.versionNo }} vs {{ compareResult.oldVersion.versionNo }}
					</span>
				</h5>
				<div style="display: flex; gap: 10px; margin-bottom: 12px; flex-wrap: wrap">
					<el-tag v-if="compareResult.summary.addCount > 0" type="success" size="small">
						+ 新增 {{ compareResult.summary.addCount }} 处
					</el-tag>
					<el-tag v-if="compareResult.summary.delCount > 0" type="danger" size="small">
						- 删除 {{ compareResult.summary.delCount }} 处
					</el-tag>
					<el-tag v-if="compareResult.summary.modCount > 0" type="warning" size="small">
						~ 修改 {{ compareResult.summary.modCount }} 处
					</el-tag>
					<el-tag type="info" size="small">{{ compareResult.summary.sizeChange }}</el-tag>
				</div>
				<div v-if="compareResult.summary.items.length > 0" class="df-change-summary">
					<div class="df-change-summary-header">
						<el-icon>
							<List />
						</el-icon>
						变更明细
					</div>
					<div class="df-change-summary-list">
						<div v-for="(item, idx) in compareResult.summary.items" :key="idx" class="df-change-summary-item">
							<div class="df-cs-icon" :class="`cs-${item.type}`">
								{{ item.type === 'add' ? '+' : item.type === 'del' ? '-' : '~' }}
							</div>
							<span>{{ item.text }}</span>
						</div>
					</div>
				</div>
			</div>
		</Transition>

		<!-- 全屏对比 -->
		<VersionCompareViewer
:visible="fullscreenCompareVisible" :data="compareResult" :loading="compareLoading"
			@close="fullscreenCompareVisible = false" @view-file="handleViewFile" />

		<!-- 上传新版本 -->
		<UploadFileModal
v-if="detail?.groupId" v-model="uploadVisible" :group-id="detail.groupId" mode="update"
			:locked-document-id="documentId" @success="onUploadSuccess" />

		<!-- 文档级权限弹窗（PRD §6.3.4，仅组管理员可见） -->
		<DocPermissionModal
v-if="detail?.groupId && detail?.canManagePermissions" v-model:visible="permModalVisible"
			:document-id="documentId" :file-name="detail.title" :group-id="detail.groupId" @saved="onPermissionsSaved" />

		<!-- 全屏预览（PRD §6.3.4 line 507 「全屏按钮」） -->
		<FullscreenPreviewer
v-model:visible="fullscreenPreviewVisible" :title="detail?.title"
			:version-no="currentVersion?.versionNo" :file-type="fileType" :html="previewHtml" :loading="previewLoading" />

		<!-- 跨组移动弹窗 -->
		<MoveTargetPicker
v-if="detail?.groupId" v-model="movePickerVisible" v-model:loading="moveLoading"
			:document-id="documentId" :exclude-group-id="detail.groupId" @confirm="onMoveConfirm" />

		<!-- 分享链接弹窗 -->
		<ShareLinkModal
v-if="detail" v-model="shareModalVisible" :document-id="documentId"
			:file-name="`${detail.title}.${detail.ext}`" />

		<!-- 版本回滚确认弹窗 -->
		<RollbackConfirmModal
v-model="rollbackVisible" :file-name="fileName" :current-version="currentVersionNo"
			:target-version="rollbackTarget?.versionNo ?? ''" :loading="rollbackLoading" @confirm="confirmRollback" />

		<!-- 底部 TAB 区（PRD §6.3.4：评论 / 飞书评论 / 审批记录） -->
		<div class="pf-card df-file-tabs">
			<TabBar v-model="bottomTab" :tabs="bottomTabs" />

			<div v-if="bottomTab === 'comments'" class="df-file-tabs__panel">
				<CommentThread
:comments="commentList" :current-user="commentCurrentUser" :readonly="false"
					:loading="commentsLoading" @submit="onCommentSubmit" @reply="onCommentReply" @delete="onCommentDelete" />
			</div>

			<div v-if="bottomTab === 'approvals'" class="df-file-tabs__panel">
				<div v-if="approvalsLoading" class="df-file-tabs__loading">
					<el-icon class="is-loading">
						<Loading />
					</el-icon>
					<span>加载中...</span>
				</div>
				<EmptyState
v-else-if="approvalRecords.length === 0" preset="no-completed" title="暂无审批记录"
					description="该文档还未发起任何审批" compact />
				<div v-else class="df-file-tabs__list">
					<ApprovalListCard
v-for="item in approvalRecords" :key="item.id" :item="item" tab="submitted"
						@open="openApprovalDetail" />
				</div>
			</div>
		</div>

		<!-- 审批详情抽屉（只读：当前用户从文件详情页打开，不暴露通过 / 驳回操作） -->
		<ApprovalDrawer v-model="approvalDrawerVisible" :approval="currentApproval" @view-file="onDrawerViewFile" />

		<!-- 历史记录抽屉 -->
		<HistoryDrawer v-model="historyDrawerVisible" :document-id="documentId" />
	</section>
</template>

<script setup lang="ts">
import {
	Back,
	Promotion,
	Upload,
	Delete,
	Download,
	Switch,
	FullScreen,
	Loading,
	Edit,
	DataAnalysis,
	List,
	Star,
	StarFilled,
	Top,
	Lock,
	Rank,
	Share,
	MoreFilled,
} from '@element-plus/icons-vue'
import type { VersionInfo, CompareResult } from '~/types/version'
import type { ApiResponse, PaginatedData } from '~/types/api'
import type { DocumentDetail, DocumentStatus } from '~/types/document'
import type {
	ApprovalItem,
	ApprovalDetail,
	ApprovalFullDetailData,
	ChangeSummaryItem,
	ChainNode,
} from '~/types/approval'
import {
	apiGetDocument,
	apiPreviewDocument,
	apiDownloadDocumentUrl,
	apiRemoveDocument,
	apiRollbackVersion,
	apiFavoriteDocument,
	apiUnfavoriteDocument,
	apiPinDocument,
	apiUnpinDocument,
	apiGetDocumentApprovals,
	apiRequestCrossMove,
} from '~/api/documents'
import { apiSubmitApproval, apiGetApproval } from '~/api/approvals'
import { apiGetComments, apiCreateComment, apiDeleteComment } from '~/api/comments'
import type { CommentVO } from '~/api/comments'
import type { CommentItem } from '~/components/CommentThread.vue'
import { formatTime, formatBytes } from '~/utils/format'

definePageMeta({
	layout: 'prototype',
})
useHead({ title: '文件详情 - DocFlow' })

const route = useRoute()
const documentId = computed(() => Number(route.params.id))

// ── 文件详情 ──
const detail = ref<DocumentDetail | null>(null)
const fileName = computed(() => detail.value?.title ?? '')
const fileType = computed(() => (detail.value?.ext ?? 'md').toLowerCase())

const FILE_TYPE_LABELS: Record<string, string> = {
	md: 'Markdown', pdf: 'PDF', docx: 'Word', xlsx: 'Excel', txt: '纯文本',
}
const FILE_TYPE_ABBRS: Record<string, string> = {
	md: 'MD', pdf: 'PDF', docx: 'DOC', xlsx: 'XLS', txt: 'TXT',
}
const fileTypeText = computed(() => FILE_TYPE_LABELS[fileType.value] || fileType.value.toUpperCase())
const fileTypeAbbr = computed(() => FILE_TYPE_ABBRS[fileType.value] || fileType.value.toUpperCase().slice(0, 3))

const STATUS_TEXT: Record<DocumentStatus, string> = {
	1: '草稿', 2: '编辑中', 3: '审批中', 4: '已发布', 5: '已驳回', 6: '已删除',
}
const STATUS_KEY: Record<DocumentStatus, string> = {
	1: 'draft', 2: 'editing', 3: 'reviewing', 4: 'published', 5: 'rejected', 6: 'deleted',
}
const statusText = computed(() => detail.value ? STATUS_TEXT[detail.value.status] : '')
const statusKey = computed(() => detail.value ? STATUS_KEY[detail.value.status] : 'draft')

async function loadDetail() {
	const res = await apiGetDocument(documentId.value)
	if (res.success) {
		detail.value = res.data
	} else {
		msgError(res.message || '加载文档失败')
	}
}

// ── 收藏 / 置顶 ──
const favoritePending = ref(false)
const pinPending = ref(false)

async function onToggleFavorite() {
	if (!detail.value || favoritePending.value) return
	favoritePending.value = true
	const orig = detail.value.isFavorited
	detail.value.isFavorited = !orig                         // 乐观更新
	try {
		const res = orig
			? await apiUnfavoriteDocument(documentId.value)
			: await apiFavoriteDocument(documentId.value)
		if (!res.success) {
			detail.value.isFavorited = orig                  // 回滚
			msgError(res.message || '操作失败')
			return
		}
		detail.value.isFavorited = res.data.isFavorited      // 服务端对账
		msgSuccess(res.message || (orig ? '已取消收藏' : '已收藏'))
	} catch {
		detail.value.isFavorited = orig
		msgError('操作失败，请重试')
	} finally {
		favoritePending.value = false
	}
}

async function onTogglePin() {
	if (!detail.value || pinPending.value) return
	pinPending.value = true
	const orig = detail.value.isPinned
	detail.value.isPinned = !orig
	try {
		const res = orig
			? await apiUnpinDocument(documentId.value)
			: await apiPinDocument(documentId.value)
		if (!res.success) {
			detail.value.isPinned = orig
			msgError(res.message || '操作失败')
			return
		}
		detail.value.isPinned = res.data.isPinned
		msgSuccess(res.message || (orig ? '已取消置顶' : '已置顶'))
	} catch {
		detail.value.isPinned = orig
		msgError('操作失败，请重试')
	} finally {
		pinPending.value = false
	}
}

// ── 版本列表 ──
const versions = ref<VersionInfo[]>([])
const currentVersion = computed(() => versions.value.find(v => v.isCurrent))

/** 协作者：从版本上传者 + 文档归属人去重 */
const collaborators = computed(() => {
	const map = new Map<number, { id: number; name: string }>()
	if (detail.value) {
		map.set(detail.value.ownerId, { id: detail.value.ownerId, name: detail.value.ownerName })
	}
	for (const v of versions.value) {
		if (!map.has(v.uploadedBy)) {
			map.set(v.uploadedBy, { id: v.uploadedBy, name: v.uploaderName })
		}
	}
	return Array.from(map.values())
})

async function fetchVersions() {
	try {
		const res = await useAuthFetch<ApiResponse<PaginatedData<VersionInfo>>>(
			`/api/documents/${documentId.value}/versions`,
		)
		if (res.success) versions.value = res.data.list
	} catch {
		msgError('获取版本列表失败')
	}
}

// ── 预览 HTML（服务端渲染） ──
const previewHtml = ref('')
const previewLoading = ref(false)
async function loadPreview() {
	if (!detail.value || !detail.value.currentVersion) {
		previewHtml.value = ''
		return
	}
	previewLoading.value = true
	try {
		const res = await apiPreviewDocument(documentId.value)
		if (res.success) previewHtml.value = res.data.html
		else previewHtml.value = '<div class="df-preview-error">加载预览失败</div>'
	} catch {
		previewHtml.value = '<div class="df-preview-error">加载预览失败</div>'
	} finally {
		previewLoading.value = false
	}
}

// ── 版本对比 ──
const compareTarget = ref<VersionInfo | null>(null)
const compareResult = ref<CompareResult | null>(null)
const compareLoading = ref(false)
const inlineComparing = ref(false)
const fullscreenCompareVisible = ref(false)

async function loadCompareResult() {
	if (!currentVersion.value || !compareTarget.value) return
	compareLoading.value = true
	try {
		const res = await useAuthFetch<ApiResponse<CompareResult>>('/api/version/compare', {
			method: 'POST',
			body: {
				documentId: documentId.value,
				fromVersionId: currentVersion.value.id,
				toVersionId: compareTarget.value.id,
			},
		})
		if (res.success) compareResult.value = res.data
	} catch {
		msgError('版本对比失败')
	} finally {
		compareLoading.value = false
	}
}

function handleCompare(version: VersionInfo) {
	compareTarget.value = version
	compareResult.value = null
	inlineComparing.value = true
	loadCompareResult()
}
function exitInlineCompare() {
	inlineComparing.value = false
	compareTarget.value = null
	compareResult.value = null
}
function openFullscreenCompare() {
	if (!compareResult.value && compareTarget.value) loadCompareResult()
	fullscreenCompareVisible.value = true
}

// ── 下载 ──
function handleDownloadVersion(version: VersionInfo) {
	window.location.href = apiDownloadDocumentUrl(documentId.value, version.id)
}

function handleDownloadCurrent() {
	window.location.href = apiDownloadDocumentUrl(documentId.value)
}

// ── 版本回滚（PRD §6.3.4 — 回滚生成新版本，不删除中间版本） ──
const rollbackVisible = ref(false)
const rollbackTarget = ref<VersionInfo | null>(null)
const rollbackLoading = ref(false)

const currentVersionNo = computed(() => {
	const cur = versions.value.find(v => v.isCurrent)
	return cur?.versionNo ?? detail.value?.currentVersion?.versionNo ?? '-'
})

function handleRollback(version: VersionInfo) {
	rollbackTarget.value = version
	rollbackVisible.value = true
}

async function confirmRollback() {
	if (!rollbackTarget.value) return
	rollbackLoading.value = true
	try {
		const res = await apiRollbackVersion(documentId.value, rollbackTarget.value.id)
		if (res.success) {
			msgSuccess(res.message || '回滚成功')
			rollbackVisible.value = false
			await Promise.all([loadDetail(), fetchVersions()])
			await loadPreview()
			// 退出对比模式（如果在对比中触发回滚）
			if (inlineComparing.value) exitInlineCompare()
		} else {
			msgError(res.message || '回滚失败')
		}
	} catch {
		msgError('回滚失败，请重试')
	} finally {
		rollbackLoading.value = false
	}
}

// ── 上传新版本 ──
const uploadVisible = ref(false)

// ── 全屏预览（PRD §6.3.4 line 507） ──
const fullscreenPreviewVisible = ref(false)

// ── 分享 ──
const shareModalVisible = ref(false)

// ── 文档级权限弹窗（PRD §6.3.4） ──
const permModalVisible = ref(false)
function onPermissionsSaved() {
	// 锁图标 hasCustomPermissions 由后端按软删后剩余条目数判定，刷新详情自动对账
	loadDetail()
}

// ── 跨组移动 ──
const { can: canPerm } = useAuth()
const canMove = computed(() => canPerm('doc:move'))
const movePickerVisible = ref(false)
const moveLoading = ref(false)

async function onMoveConfirm(targetGroupId: number) {
	moveLoading.value = true
	try {
		const res = await apiRequestCrossMove(documentId.value, targetGroupId)
		if (res.success) {
			msgSuccess(res.message || '移动请求已发起')
			movePickerVisible.value = false
		} else {
			msgError(res.message || '发起移动失败')
		}
	} catch {
		msgError('发起移动失败')
	} finally {
		moveLoading.value = false
	}
}
function onVersionSidebarUpload() {
	if (!detail.value?.canUploadVersion) {
		msgWarning('当前状态或权限不允许上传新版本')
		return
	}
	uploadVisible.value = true
}
async function onUploadSuccess() {
	await Promise.all([loadDetail(), fetchVersions()])
	await loadPreview()
}

// ── 提交审批 ──
const submitLoading = ref(false)
async function handleSubmitApproval() {
	if (!detail.value?.currentVersion) {
		msgWarning('文档尚无可提交的版本')
		return
	}
	const ok = await msgConfirm('确定将当前版本提交审批？', '提交审批', { type: 'warning' })
	if (!ok) return
	submitLoading.value = true
	try {
		const res = await apiSubmitApproval({
			documentId: documentId.value,
			versionId: detail.value.currentVersion.id,
		})
		if (res.success) {
			msgSuccess(res.message || '已提交审批')
			await Promise.all([loadDetail(), loadApprovalRecords()])
		} else {
			msgError(res.message || '提交失败')
		}
	} catch {
		msgError('提交失败')
	} finally {
		submitLoading.value = false
	}
}

// ── 移除 ──
const removing = ref(false)
async function handleRemove() {
	if (!detail.value) return
	const ok = await msgConfirm(
		`从组移除后，文件「${detail.value.title}」将退回归属人 ${detail.value.ownerName} 的个人中心（可被恢复）。`,
		'确认移除',
		{ type: 'warning', confirmText: '确认移除', danger: true },
	)
	if (!ok) return
	removing.value = true
	try {
		const res = await apiRemoveDocument(documentId.value)
		if (res.success) {
			msgSuccess(res.message || '已移除')
			if (detail.value?.groupId) {
				navigateTo(`/docs?groupId=${detail.value.groupId}`)
			} else {
				navigateTo('/docs')
			}
		} else {
			msgError(res.message || '移除失败')
		}
	} catch {
		msgError('移除失败')
	} finally {
		removing.value = false
	}
}

function handleViewFile() {
	fullscreenCompareVisible.value = false
}

// ── 底部 TAB（PRD §6.3.4） ──
type BottomTab = 'comments' | 'approvals'
const bottomTab = ref<BottomTab>('comments')
const bottomTabs: Array<{ value: BottomTab; label: string }> = [
	{ value: 'comments', label: '评论' },
	{ value: 'approvals', label: '审批记录' },
]

// ── 审批记录 ──
const approvalRecords = ref<ApprovalItem[]>([])
const approvalsLoading = ref(false)
const approvalsLoaded = ref(false)

async function loadApprovalRecords() {
	approvalsLoading.value = true
	try {
		const res = await apiGetDocumentApprovals(documentId.value)
		if (res.success) {
			approvalRecords.value = res.data
			approvalsLoaded.value = true
		} else {
			msgError(res.message || '加载审批记录失败')
		}
	} catch {
		msgError('加载审批记录失败')
	} finally {
		approvalsLoading.value = false
	}
}

// tab 激活时懒加载
watch(bottomTab, (val) => {
	if (val === 'approvals' && !approvalsLoaded.value) loadApprovalRecords()
	if (val === 'comments' && !commentsLoaded.value) loadComments()
})

// ── 评论模块 ──
const commentList = ref<CommentItem[]>([])
const commentsLoading = ref(false)
const commentsLoaded = ref(false)

const commentCurrentUser = computed(() => ({
	name: useAuthStore().user?.name || '我',
	avatar: useAuthStore().user?.avatar || undefined,
}))

function toCommentItem(vo: CommentVO): CommentItem {
	return {
		id: vo.id,
		user: vo.user,
		content: vo.content,
		time: vo.time,
		deletable: vo.deletable,
		replies: vo.replies?.map(toCommentItem) || [],
	}
}

async function loadComments() {
	commentsLoading.value = true
	try {
		const res = await apiGetComments(documentId.value)
		if (res.success) {
			commentList.value = res.data.map(toCommentItem)
			commentsLoaded.value = true
		}
	} catch { /* silent */ } finally {
		commentsLoading.value = false
	}
}

async function onCommentSubmit(content: string) {
	const res = await apiCreateComment(documentId.value, { content })
	if (res.success) {
		commentList.value.push(toCommentItem(res.data))
		msgSuccess(res.message || '评论成功')
	} else {
		msgError(res.message || '评论失败')
	}
}

async function onCommentReply(payload: { commentId: string | number; content: string }) {
	const res = await apiCreateComment(documentId.value, {
		content: payload.content,
		parentId: Number(payload.commentId),
	})
	if (res.success) {
		const parent = commentList.value.find(c => c.id === payload.commentId)
		if (parent) {
			if (!parent.replies) parent.replies = []
			parent.replies.push(toCommentItem(res.data))
		}
		msgSuccess(res.message || '回复成功')
	} else {
		msgError(res.message || '回复失败')
	}
}

async function onCommentDelete(commentId: string | number) {
	const res = await apiDeleteComment(documentId.value, Number(commentId))
	if (res.success) {
		// 顶层评论直接移除；回复从父级 replies 中过滤
		const topIdx = commentList.value.findIndex(c => c.id === commentId)
		if (topIdx !== -1) {
			commentList.value.splice(topIdx, 1)
		} else {
			for (const c of commentList.value) {
				if (c.replies) {
					c.replies = c.replies.filter(r => r.id !== commentId)
				}
			}
		}
		msgSuccess(res.message || '删除成功')
	} else {
		msgError(res.message || '删除失败')
	}
}

// ── 审批详情抽屉（只读） ──
const approvalDrawerVisible = ref(false)
const currentApproval = ref<ApprovalDetail | null>(null)

async function openApprovalDetail(id: number) {
	currentApproval.value = null
	approvalDrawerVisible.value = true
	try {
		const res = await apiGetApproval(id)
		if (!res.success) {
			msgError(res.message || '加载审批详情失败')
			approvalDrawerVisible.value = false
			return
		}
		currentApproval.value = await buildReadonlyApprovalDetail(res.data)
	} catch {
		msgError('加载审批详情失败')
		approvalDrawerVisible.value = false
	}
}

/**
 * 构造只读模式的 ApprovalDetail
 * 与 approvals.vue 的 buildApprovalDetail 区别：
 *   即便实例 status=2（审批中），也强制映射为 'approved' 抽屉状态，
 *   以隐藏「通过 / 驳回」操作区与按钮 —— 文件详情页是历史只读视图
 *   chain 节点状态独立于此，仍按真实 actionStatus + currentNodeOrder 渲染
 */
async function buildReadonlyApprovalDetail(data: ApprovalFullDetailData): Promise<ApprovalDetail> {
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
		return { name: n.approverName, status, statusText }
	})

	// 只读：status=2 也按 approved 显示（隐藏通过 / 驳回区）；3=approved，4/5=rejected
	const drawerStatus: ApprovalDetail['status'] = data.status === 4 || data.status === 5
		? 'rejected'
		: 'approved'

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
		} catch { /* 摘要失败不致命 */ }
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

function onDrawerViewFile(_approval: ApprovalDetail) {
	// 已在文件详情页，关闭抽屉即可
	approvalDrawerVisible.value = false
}

/** 返回按钮文案：有组名 → 「返回 [组名]」；否则 → 「返回共享文档」 */
const backLabel = computed(() => {
	const name = detail.value?.groupName
	return name ? `返回 ${name}` : '返回共享文档'
})

function backToGroup() {
	if (detail.value?.groupId) {
		navigateTo(`/docs?groupId=${detail.value.groupId}`)
	} else {
		navigateTo('/docs')
	}
}

// ── 编辑（TODO: 对接在线编辑器） ──
function handleEdit() {
	msgSuccess('编辑功能开发中，敬请期待')
}

// ── 更多菜单 ──
const historyDrawerVisible = ref(false)

function handleMoreCommand(command: string) {
	switch (command) {
		case 'permission': permModalVisible.value = true; break
		case 'move': movePickerVisible.value = true; break
		case 'upload': uploadVisible.value = true; break
		case 'history': historyDrawerVisible.value = true; break
		case 'remove': handleRemove(); break
	}
}

// ── 初始化 ──
onMounted(async () => {
	await loadDetail()
	await Promise.all([fetchVersions(), loadPreview(), loadApprovalRecords(), loadComments()])
})
</script>

<style scoped>
.slide-fade-enter-active {
	transition: all 0.3s ease-out;
}

.slide-fade-leave-active {
	transition: all 0.2s ease-in;
}

.slide-fade-enter-from {
	opacity: 0;
	transform: translateY(-12px);
}

.slide-fade-leave-to {
	opacity: 0;
	transform: translateY(-8px);
}
</style>
