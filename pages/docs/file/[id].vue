<template>
	<section class="pf-page-stack">
		<PageTitle :title="fileName" subtitle="预览、版本、评论与审批记录">
			<template #actions>
				<el-button type="primary" @click="handleSubmitApproval">
					提交审批
				</el-button>
				<el-button @click="navigateTo(`/docs/repo/${repoId}`)">
					返回仓库
				</el-button>
			</template>
		</PageTitle>

		<!-- 文件信息卡 -->
		<div class="pf-card file-header">
			<div style="
					display: flex;
					align-items: center;
					gap: 12px;
					padding: 12px 16px;
				">
				<span style="font-size: 28px">{{ fileIcon }}</span>
				<div style="flex: 1">
					<h4 style="margin: 0; font-size: 15px">{{ fileName }}</h4>
					<p class="pf-muted" style="margin: 4px 0 0; font-size: 12px">
						文件ID：{{ route.params.id }} · 当前版本：{{
							currentVersion?.versionNo || '-'
						}}
						· 状态：{{ statusText }}
					</p>
				</div>
			</div>
		</div>

		<!-- 预览区 + 版本侧边栏 -->
		<div class="df-file-split">
			<!-- 左侧：预览 / 页内对比 -->
			<div class="df-preview-pane">
				<!-- 页内对比模式条 -->
				<div v-if="inlineComparing" class="df-compare-exit">
					<span>📋 版本对比模式</span>
					<span style="font-weight: 600">
						{{ currentVersion?.versionNo }} vs
						{{ compareTarget?.versionNo }}
					</span>
					<el-button size="small" style="margin-left: auto" @click="exitInlineCompare">
						退出对比
					</el-button>
					<el-button size="small" type="primary" @click="openFullscreenCompare">
						全屏对比
					</el-button>
				</div>

				<!-- 正常预览模式 -->
				<template v-if="!inlineComparing">
					<div class="df-preview-toolbar">
						<span class="preview-ver">
							{{ currentVersion?.versionNo || '-' }}（当前）
						</span>
						<span style="
								width: 1px;
								height: 14px;
								background: var(--df-border);
							"></span>
						<span>{{ fileTypeText }} 文档</span>
						<span style="margin-left: auto"></span>
						<el-button size="small" text @click="openFullscreenCompare" :disabled="!compareTarget">
							↔ 全屏对比
						</el-button>
					</div>
					<el-scrollbar>
						<div class="df-preview-body">
							<div class="preview-doc">
								<h5>文档内容预览</h5>
								<p>
									这里对齐原型中的文档预览区，后续可接入
									Markdown / Office / PDF 渲染。
								</p>
								<p>
									当前季度用户转化率为
									<mark>12.5%</mark>
									，并附带飞书批注挂点。
								</p>
								<p>
									后续将按原型补齐批注 popover、定位跳转、版本变更高亮。
								</p>
							</div>
						</div>
					</el-scrollbar>
				</template>

				<!-- 页内对比模式 -->
				<template v-else-if="compareResult">
					<div class="df-compare-split">
						<div class="df-compare-pane">
							<div class="cp-header">
								<span style="
										padding: 2px 8px;
										background: #fecaca;
										border-radius: 4px;
									">
									旧版
								</span>
								<span>{{ compareResult.oldVersion.versionNo }}</span>
							</div>
							<el-scrollbar>
								<div class="cp-body" v-html="compareResult.oldVersion.html"></div>
							</el-scrollbar>
						</div>
						<div class="df-compare-pane">
							<div class="cp-header">
								<span style="
										padding: 2px 8px;
										background: #bbf7d0;
										border-radius: 4px;
									">
									新版
								</span>
								<span>{{ compareResult.newVersion.versionNo }}</span>
							</div>
							<el-scrollbar>
								<div class="cp-body" v-html="compareResult.newVersion.html"></div>
							</el-scrollbar>
						</div>
					</div>
				</template>
			</div>

			<!-- 右侧：版本侧边栏 -->
			<VersionSidebar :versions="versions" @download="handleDownload" @rollback="handleRollback"
				@compare="handleCompare" @upload="handleUpload" />
		</div>

		<!-- 变更摘要（仅在对比时显示） -->
		<div v-if="compareResult && compareResult.summary" class="pf-card" style="padding: 16px">
			<h5 style="margin: 0 0 12px; font-size: 14px">
				📋 版本变更摘要
				<span style="
						font-size: 12px;
						font-weight: 400;
						color: var(--df-subtext);
						margin-left: 8px;
					">
					{{ compareResult.newVersion.versionNo }} vs
					{{ compareResult.oldVersion.versionNo }}
				</span>
			</h5>
			<div style="
					display: flex;
					gap: 10px;
					margin-bottom: 12px;
					flex-wrap: wrap;
				">
				<el-tag v-if="compareResult.summary.addCount > 0" type="success" size="small">
					+ 新增 {{ compareResult.summary.addCount }} 处
				</el-tag>
				<el-tag v-if="compareResult.summary.delCount > 0" type="danger" size="small">
					- 删除 {{ compareResult.summary.delCount }} 处
				</el-tag>
				<el-tag v-if="compareResult.summary.modCount > 0" type="warning" size="small">
					~ 修改 {{ compareResult.summary.modCount }} 处
				</el-tag>
				<el-tag type="info" size="small">
					📀 {{ compareResult.summary.sizeChange }}
				</el-tag>
			</div>
			<div v-if="compareResult.summary.items.length > 0" class="df-change-summary">
				<div class="df-change-summary-header">📋 变更明细</div>
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

		<!-- 全屏对比器 -->
		<VersionCompareViewer :visible="fullscreenCompareVisible" :data="compareResult" :loading="compareLoading"
			@close="fullscreenCompareVisible = false" @view-file="handleViewFile" />
	</section>
</template>

<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus'
import type { VersionInfo, CompareResult } from '~/types/version'
import type { ApiResponse, PaginatedData } from '~/types/api'

definePageMeta({
	layout: 'default',
})

const route = useRoute()
const documentId = computed(() => Number(route.params.id))
const repoId = computed(() => route.query.repo || '1')

// ── 文件基本信息 ──
const fileName = ref('数据库优化方案.docx')
const fileType = ref('docx')
const statusText = ref('已发布')

const FILE_ICONS: Record<string, string> = {
	md: '📝',
	pdf: '📕',
	docx: '📘',
	xlsx: '📊',
	txt: '📄',
}
const FILE_TYPE_LABELS: Record<string, string> = {
	md: 'Markdown',
	pdf: 'PDF',
	docx: 'Word',
	xlsx: 'Excel',
	txt: '纯文本',
}
const fileIcon = computed(() => FILE_ICONS[fileType.value] || '📄')
const fileTypeText = computed(() => FILE_TYPE_LABELS[fileType.value] || fileType.value)

// ── 版本列表 ──
const versions = ref<VersionInfo[]>([])
const currentVersion = computed(() => versions.value.find((v) => v.isCurrent))

async function fetchVersions() {
	try {
		const res = await useAuthFetch<ApiResponse<PaginatedData<VersionInfo>>>(
			`/api/documents/${documentId.value}/versions`
		)
		if (res.success) {
			versions.value = res.data.list
		}
	} catch {
		ElMessage.error('获取版本列表失败')
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
		const res = await useAuthFetch<ApiResponse<CompareResult>>(
			'/api/version/compare',
			{
				method: 'POST',
				body: {
					documentId: documentId.value,
					fromVersionId: currentVersion.value.id,
					toVersionId: compareTarget.value.id,
				},
			}
		)
		if (res.success) {
			compareResult.value = res.data
		}
	} catch {
		ElMessage.error('版本对比失败')
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
	if (!compareResult.value && compareTarget.value) {
		loadCompareResult()
	}
	fullscreenCompareVisible.value = true
}

// ── 其他操作 ──
function handleDownload(version: VersionInfo) {
	ElMessage.success(`已开始下载 ${version.versionNo}`)
}

async function handleRollback(version: VersionInfo) {
	try {
		await ElMessageBox.confirm(
			`确定要将文件「${fileName.value}」回滚到 ${version.versionNo} 吗？\n回滚后将创建一个新版本，当前版本不会丢失。`,
			'确认回滚版本',
			{ confirmButtonText: '确认回滚', cancelButtonText: '取消', type: 'warning' }
		)
		ElMessage.success(`已回滚到 ${version.versionNo}，已创建新版本`)
		fetchVersions()
	} catch {
		// 取消
	}
}

function handleUpload() {
	ElMessage.info('上传新版本功能开发中')
}

function handleSubmitApproval() {
	ElMessage.info('提交审批功能开发中')
}

function handleViewFile() {
	fullscreenCompareVisible.value = false
	ElMessage.info('全屏预览功能开发中')
}

// ── 初始化 ──
onMounted(() => {
	fetchVersions()
})
</script>
