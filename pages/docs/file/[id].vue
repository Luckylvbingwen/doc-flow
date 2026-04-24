<template>
	<section class="pf-page-stack">
		<PageTitle :title="fileName || '加载中...'" :subtitle="subtitle">
			<template #actions>
				<el-button @click="backToRepo">
					<el-icon>
						<Back />
					</el-icon>
					返回仓库
				</el-button>
				<el-button
v-if="detail?.canSubmitApproval" type="primary" :loading="submitLoading"
					@click="handleSubmitApproval">
					<el-icon>
						<Promotion />
					</el-icon>
					提交审批
				</el-button>
				<el-button v-if="detail?.canUploadVersion" type="primary" @click="uploadVisible = true">
					<el-icon>
						<Upload />
					</el-icon>
					上传新版本
				</el-button>
				<el-button v-if="detail?.canRemove" type="danger" plain :loading="removing" @click="handleRemove">
					<el-icon>
						<Delete />
					</el-icon>
					从组移除
				</el-button>
			</template>
		</PageTitle>

		<!-- 文件信息卡 -->
		<div v-if="detail" class="pf-card">
			<div class="df-file-info-card">
				<div class="df-file-icon" :class="`df-file-icon--${fileType}`">
					{{ fileTypeAbbr }}
				</div>
				<div class="df-file-info-body">
					<h4 class="df-file-info-name">{{ fileName }}</h4>
					<p class="df-file-info-meta">
						<span>{{ fileTypeText }} · {{ currentVersion?.versionNo || '-' }}</span>
						<span class="file-status" :class="`file-status--${statusKey}`">
							{{ statusText }}
						</span>
						<span v-if="detail.currentVersion?.publishedAt">
							· 发布于 {{ formatTime(detail.currentVersion.publishedAt, 'YYYY-MM-DD HH:mm') }}
						</span>
					</p>
				</div>
			</div>
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
:versions="versions" @download="handleDownloadVersion" @rollback="handleRollback"
				@compare="handleCompare" @upload="onVersionSidebarUpload" />
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
	</section>
</template>

<script setup lang="ts">
import {
	Back,
	Promotion,
	Upload,
	Delete,
	Switch,
	FullScreen,
	Loading,
	DataAnalysis,
	List,
} from '@element-plus/icons-vue'
import type { VersionInfo, CompareResult } from '~/types/version'
import type { ApiResponse, PaginatedData } from '~/types/api'
import type { DocumentDetail, DocumentStatus } from '~/types/document'
import {
	apiGetDocument,
	apiPreviewDocument,
	apiDownloadDocumentUrl,
	apiRemoveDocument,
} from '~/api/documents'
import { apiSubmitApproval } from '~/api/approvals'
import { formatTime } from '~/utils/format'

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

const subtitle = computed(() => {
	if (!detail.value) return ''
	const parts = ['预览、版本管理与对比']
	if (detail.value.groupName) parts.unshift(`所属 ${detail.value.groupName}`)
	return parts.join(' · ')
})

async function loadDetail() {
	const res = await apiGetDocument(documentId.value)
	if (res.success) {
		detail.value = res.data
	} else {
		msgError(res.message || '加载文档失败')
	}
}

// ── 版本列表 ──
const versions = ref<VersionInfo[]>([])
const currentVersion = computed(() => versions.value.find(v => v.isCurrent))

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

// ── 回滚（A 阶段暂未做，按钮提示） ──
function handleRollback(_version: VersionInfo) {
	msgInfo('版本回滚功能将在 B 阶段上线；当前可通过「上传新版本」手工替代')
}

// ── 上传新版本 ──
const uploadVisible = ref(false)
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
			await loadDetail()
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
				navigateTo(`/docs/repo/${detail.value.groupId}`)
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

function backToRepo() {
	if (detail.value?.groupId) {
		navigateTo(`/docs/repo/${detail.value.groupId}`)
	} else {
		navigateTo('/docs')
	}
}

// ── 初始化 ──
onMounted(async () => {
	await loadDetail()
	await Promise.all([fetchVersions(), loadPreview()])
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
