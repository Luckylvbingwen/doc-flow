<template>
	<section class="pf-page-stack">
		<PageTitle :title="fileName" subtitle="预览、版本管理与对比">
			<template #actions>
				<el-button @click="navigateTo(`/docs/repo/${repoId}`)">
					<el-icon>
						<Back />
					</el-icon>
					返回仓库
				</el-button>
				<el-button type="primary" @click="handleSubmitApproval">
					<el-icon>
						<Promotion />
					</el-icon>
					提交审批
				</el-button>
			</template>
		</PageTitle>

		<!-- 文件信息卡 -->
		<div class="pf-card">
			<div class="df-file-info-card">
				<div class="df-file-icon" :class="`df-file-icon--${fileType}`">
					{{ fileTypeAbbr }}
				</div>
				<div class="df-file-info-body">
					<h4 class="df-file-info-name">{{ fileName }}</h4>
					<p class="df-file-info-meta">
						<span>
							{{ fileTypeText }} · {{
								currentVersion?.versionNo || '-'
							}}
						</span>
						<span class="file-status" :class="`file-status--${statusKey}`">
							{{ statusText }}
						</span>
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
					<el-icon>
						<Switch />
					</el-icon>
					<span>版本对比模式</span>
					<span style="font-weight: 600">
						{{ currentVersion?.versionNo }} vs
						{{ compareTarget?.versionNo }}
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
						<span class="preview-ver">
							{{ currentVersion?.versionNo || '-' }}（当前）
						</span>
						<span
style="
								width: 1px;
								height: 14px;
								background: var(--df-border);
							"/>
						<span>{{ fileTypeText }} 文档</span>
						<span style="margin-left: auto"/>
						<el-button size="small" text :disabled="!compareTarget" @click="openFullscreenCompare">
							<el-icon>
								<FullScreen />
							</el-icon>
							全屏对比
						</el-button>
					</div>
					<el-scrollbar>
						<div class="df-preview-body">
							<DocPreview :file-type="fileType" :content="mockPreviewContent" :loading="previewLoading" />
						</div>
					</el-scrollbar>
				</template>

				<!-- 页内对比模式 -->
				<template v-else>
					<!-- 对比加载中 -->
					<div
v-if="compareLoading" style="
							flex: 1;
							display: flex;
							align-items: center;
							justify-content: center;
							gap: 10px;
							color: var(--df-subtext);
							font-size: 13px;
						">
						<el-icon class="is-loading" :size="24" color="var(--df-primary)">
							<Loading />
						</el-icon>
						<span>正在计算差异…</span>
					</div>
					<!-- 对比结果 -->
					<div v-else-if="compareResult" class="df-compare-split">
						<div class="df-compare-pane">
							<div class="cp-header">
								<span
style="
										padding: 2px 8px;
										background: #fecaca;
										border-radius: 4px;
									">
									旧版
								</span>
								<span>{{
									compareResult.oldVersion.versionNo
								}}</span>
							</div>
							<el-scrollbar>
								<div class="cp-body" v-html="sanitize(compareResult.oldVersion.html)"/>
							</el-scrollbar>
						</div>
						<div class="df-compare-pane">
							<div class="cp-header">
								<span
style="
										padding: 2px 8px;
										background: #bbf7d0;
										border-radius: 4px;
									">
									新版
								</span>
								<span>{{
									compareResult.newVersion.versionNo
								}}</span>
							</div>
							<el-scrollbar>
								<div class="cp-body" v-html="sanitize(compareResult.newVersion.html)"/>
							</el-scrollbar>
						</div>
					</div>
				</template>
			</div>

			<!-- 右侧：版本侧边栏 -->
			<VersionSidebar
:versions="versions" @download="handleDownload" @rollback="handleRollback"
				@compare="handleCompare" @upload="handleUpload" />
		</div>

		<!-- 变更摘要（仅在对比时显示） -->
		<Transition name="slide-fade">
			<div v-if="compareResult && compareResult.summary" class="pf-card" style="padding: 16px">
				<h5
style="
						margin: 0 0 12px;
						font-size: 14px;
						display: flex;
						align-items: center;
						gap: 8px;
					">
					<el-icon color="var(--df-primary)">
						<DataAnalysis />
					</el-icon>
					版本变更摘要
					<span
style="
							font-size: 12px;
							font-weight: 400;
							color: var(--df-subtext);
						">
						{{ compareResult.newVersion.versionNo }} vs
						{{ compareResult.oldVersion.versionNo }}
					</span>
				</h5>
				<div
style="
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
						{{ compareResult.summary.sizeChange }}
					</el-tag>
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
								{{
									item.type === 'add'
										? '+'
										: item.type === 'del'
											? '-'
											: '~'
								}}
							</div>
							<span>{{ item.text }}</span>
						</div>
					</div>
				</div>
			</div>
		</Transition>

		<!-- 全屏对比器 -->
		<VersionCompareViewer
:visible="fullscreenCompareVisible" :data="compareResult" :loading="compareLoading"
			@close="fullscreenCompareVisible = false" @view-file="handleViewFile" />
	</section>
</template>

<script setup lang="ts">
import {
	Back,
	Promotion,
	Switch,
	FullScreen,
	Loading,
	DataAnalysis,
	List,
} from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { VersionInfo, CompareResult } from '~/types/version'
import type { ApiResponse, PaginatedData } from '~/types/api'

const { sanitize } = useSanitize()

definePageMeta({
	layout: 'prototype',
})
useHead({ title: '文件详情 - DocFlow' })

const route = useRoute()
const documentId = computed(() => Number(route.params.id))
const repoId = computed(() => route.query.repo || '1')

// ── 文件基本信息 ──
const fileName = ref('数据库优化方案.docx')
const fileType = ref('docx')
const statusText = ref('已发布')
const statusKey = ref('published')

const FILE_TYPE_LABELS: Record<string, string> = {
	md: 'Markdown',
	pdf: 'PDF',
	docx: 'Word',
	xlsx: 'Excel',
	txt: '纯文本',
}
const FILE_TYPE_ABBRS: Record<string, string> = {
	md: 'MD',
	pdf: 'PDF',
	docx: 'DOC',
	xlsx: 'XLS',
	txt: 'TXT',
}
const fileTypeText = computed(
	() => FILE_TYPE_LABELS[fileType.value] || fileType.value
)
const fileTypeAbbr = computed(
	() => FILE_TYPE_ABBRS[fileType.value] || fileType.value.toUpperCase().slice(0, 3)
)

// ── 预览内容（Mock） ──
const previewLoading = ref(false)
const mockPreviewContent = computed(() => {
	if (fileType.value === 'md') {
		return [
			'# 数据库优化方案',
			'',
			'## 一、项目背景',
			'',
			'随着企业协同办公市场的快速发展，主流协同办公平台在文档管理、即时通讯、项目管理等领域不断迭代升级。',
			'',
			'## 二、竞品概览',
			'',
			'| 产品 | 核心定位 | 用户规模 |',
			'|---|---|---|',
			'| 飞书 | 一站式协作 | 500万+ |',
			'| 钉钉 | 数字化工作 | 6亿+ |',
			'',
			'## 三、优化方案',
			'',
			'根据评审反馈，补充了详细的实施方案。针对文档协作场景，建议从以下三个维度进行优化：',
			'',
			'1. **实时协作能力** — 支持多人同时编辑',
			'2. **版本管理机制** — 自动版本记录，支持回滚和对比',
			'3. **审批流程集成** — 文档发布前支持配置多级审批链',
			'',
			'> 审批过程中提供变更摘要供审批人快速了解改动。',
			'',
			'## 四、实施时间表',
			'',
			'| 阶段 | 时间 | 目标 |',
			'|---|---|---|',
			'| 第一阶段 | 3月 | 完成基础架构搭建 |',
			'| 第二阶段 | 4月 | 核心功能开发 |',
			'| 第三阶段 | 5月 | 灰度测试与优化 |',
			'',
			'## 五、现有内容',
			'',
			'更新了数据指标和预期目标。当前文档管理功能覆盖率已达到 **85%**，预计 Q2 可达 **95%**。',
		].join('\n')
	}
	return ''
})

// ── 版本列表 ──
const versions = ref<VersionInfo[]>([])
const currentVersion = computed(() =>
	versions.value.find((v) => v.isCurrent)
)

async function fetchVersions() {
	try {
		const res = await useAuthFetch<
			ApiResponse<PaginatedData<VersionInfo>>
		>(`/api/documents/${documentId.value}/versions`)
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
			{
				confirmButtonText: '确认回滚',
				cancelButtonText: '取消',
				type: 'warning',
			}
		)
		ElMessage.success(
			`已回滚到 ${version.versionNo}，已创建新版本`
		)
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
	// Mock：模拟将 docx 切换为 md 以展示 Markdown 预览效果
	fileType.value = 'md'
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
