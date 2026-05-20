<template>
	<div class="editor-shell">
		<!-- ─── 顶栏 ─── -->
		<header class="editor-topbar">
			<div class="editor-topbar__left">
				<el-button link class="editor-back-btn" @click="handleBack">
					<el-icon>
						<ArrowLeft />
					</el-icon>
				</el-button>
				<input v-model="title" class="editor-title-input" placeholder="未命名文档" maxlength="100" @input="onTitleInput">
				<span class="editor-save-status" :class="`is-${saveStatus}`">{{ saveStatusLabel }}</span>
				<el-button
link size="small" :type="tocOpen ? 'primary' : ''" class="editor-toc-toggle"
					@click="tocOpen = !tocOpen">
					<el-icon>
						<Document />
					</el-icon>
				</el-button>
			</div>

			<div class="editor-topbar__center">
				<!-- Presence 在线协作者 -->
				<el-tooltip v-if="onlineUsers.length > 0" placement="bottom">
					<template #content>
						<div v-for="u in onlineUsers" :key="u.id">{{ u.name }}</div>
					</template>
					<div class="editor-presence">
						<span
v-for="u in onlineUsers.slice(0, 3)" :key="u.id" class="editor-presence__avatar"
							:style="{ background: u.color }">
							{{ u.name.slice(0, 1) }}
						</span>
						<span v-if="onlineUsers.length > 3" class="editor-presence__more">
							+{{ onlineUsers.length - 3 }}
						</span>
					</div>
				</el-tooltip>
			</div>

			<div class="editor-topbar__right">
				<!-- 下载 -->
				<el-button size="small" @click="handleDownload">
					<el-icon>
						<Download />
					</el-icon>
				</el-button>
				<!-- 批注面板切换 -->
				<el-button size="small" @click="annotationOpen = !annotationOpen">批注</el-button>
				<!-- 提交发布 -->
				<el-button type="primary" size="small" :disabled="saveStatus === 'saving'" @click="handlePublish">
					提交发布
				</el-button>
				<!-- 更多 -->
				<el-dropdown trigger="click">
					<el-button size="small">
						<el-icon>
							<MoreFilled />
						</el-icon>
					</el-button>
					<template #dropdown>
						<el-dropdown-menu>
							<el-dropdown-item @click="snapshotDrawerVisible = true">历史记录</el-dropdown-item>
							<el-dropdown-item @click="handleQuickSnapshot">保存快照</el-dropdown-item>
							<el-dropdown-item divided @click="handleTransfer">转移归属人</el-dropdown-item>
							<el-dropdown-item @click="handleShare">分享</el-dropdown-item>
							<el-dropdown-item divided style="color: #ef4444" @click="handleDeleteOrCancel">
								{{ docStatus === 1 ? '删除草稿' : '取消编辑' }}
							</el-dropdown-item>
						</el-dropdown-menu>
					</template>
				</el-dropdown>
			</div>
		</header>

		<!-- 快照预览横幅 -->
		<div v-if="previewMode" class="editor-preview-banner">
			正在预览快照：{{ previewName }}
			<el-button size="small" link @click="exitPreview">退出预览</el-button>
		</div>

		<!-- 自动保存快照失败警示 -->
		<div v-if="autoSnapshotFailed" class="editor-preview-banner" style="background: #fef3c7; color: #92400e">
			⚠ 自动保存快照失败，请检查网络连接
		</div>

		<!-- ─── 主体 ─── -->
		<div class="editor-body">
			<!-- TOC 目录侧栏 -->
			<aside v-if="tocOpen && tocHeadings.length > 0" class="editor-toc">
				<div class="editor-toc__header">
					<span>目录</span>
					<el-button link size="small" @click="tocOpen = false">
						<el-icon>
							<Close />
						</el-icon>
					</el-button>
				</div>
				<el-scrollbar class="editor-toc__body">
					<div
v-for="item in tocHeadings" :key="item.id" class="editor-toc__item"
						:style="{ paddingLeft: `${(item.level - 1) * 12 + 8}px` }" :title="item.text">
						{{ item.text }}
					</div>
				</el-scrollbar>
			</aside>

			<!-- 编辑区 -->
			<main ref="editorMainRef" class="editor-main" @click="activeAnnotationId = undefined">
				<!-- 快照预览内容（只读覆盖） -->
				<div v-if="previewMode" class="editor-preview-content markdown-body" v-html="sanitize(previewHtml)" />
				<ClientOnly v-else>
					<MilkdownEditor
v-if="!loading && content !== null" ref="milkdownRef" :initial-content="content"
						:doc-id="docId" :enable-collab="enableCollab" @update="onEditorUpdate"
						@presence-update="onPresenceUpdate" />
					<div v-else class="editor-loading">
						<el-skeleton :rows="8" animated />
					</div>
				</ClientOnly>
			</main>

			<!-- 批注面板 -->
			<aside v-if="annotationOpen && !previewMode" class="editor-annotation-aside">
				<AnnotationPanel
ref="annotationPanelRef" :doc-id="docId" :active-annotation-id="activeAnnotationId"
					@request-add="activeAnnotationId = undefined" @locate="onAnnotationLocate" @close="annotationOpen = false" />
			</aside>
		</div>

		<!-- 发布弹窗复用 -->
		<PublishModal v-if="publishTarget" v-model="publishModalVisible" :doc="publishTarget" @success="onPublishSuccess" />

		<!-- 转移归属人弹窗复用 -->
		<OwnershipTransferModal
v-if="docId" v-model="transferModalVisible" :document-id="docId" :document-title="title"
			:exclude-user-id="currentUserId" @success="handleBack" />

		<!-- 分享弹窗复用 -->
		<ShareLinkModal
v-if="docId" v-model="shareModalVisible" :document-id="docId" :file-name="`${title}.md`"
			:can-edit="true" />

		<!-- 历史记录 / 快照抽屉 -->
		<SnapshotDrawer
v-if="docId" v-model="snapshotDrawerVisible" :doc-id="docId" @preview="onSnapshotPreview"
			@restored="onSnapshotRestored" />

		<!-- 选字批注浮层 -->
		<AnnotationSelector :doc-id="docId" :container-ref="editorMainRef" @created="onAnnotationCreated" />
	</div>
</template>

<script setup lang="ts">
import { ArrowLeft, Close, Document, Download, MoreFilled } from '@element-plus/icons-vue'
import { sanitize } from '~/composables/useSanitize'
import { apiGetDocContent } from '~/api/document-editor'
import { apiCreateSnapshot } from '~/api/documents'
import { apiDeleteDraft } from '~/api/personal'
import { useDocEditor } from '~/composables/useDocEditor'
import type { PersonalDocItem } from '~/types/personal'

definePageMeta({ layout: 'editor' })
useHead({ title: '编辑器 - DocFlow' })

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const { msgError, msgSuccess, msgConfirm } = useNotify()
const currentUserId = computed(() => authStore.user?.id ?? 0)

const docId = computed(() => Number(route.params.id))
const enableCollab = ref(true)

// ── 内容加载 ──
const title = ref('未命名文档')
const content = ref<string | null>(null)
const loading = ref(true)
const docStatus = ref<number>(1) // 1=草稿 2=编辑中

onMounted(async () => {
	const res = await apiGetDocContent(docId.value)
	if (res.success) {
		title.value = res.data.title
		content.value = res.data.content
		docStatus.value = res.data.status
		extractHeadings(res.data.content)
	} else {
		msgError(res.message || '加载失败')
		router.back()
	}
	loading.value = false
})

// ── 自动保存 ──
const { saveStatus, saveStatusLabel, autoSnapshotFailed, onContentChange, flushSave } = useDocEditor(docId)

// ── TOC 目录 ──
interface TocItem { level: number; text: string; id: string }
const tocOpen = ref(true)
const tocHeadings = ref<TocItem[]>([])

function extractHeadings(markdown: string) {
	const lines = markdown.split('\n')
	const items: TocItem[] = []
	for (const line of lines) {
		const match = line.match(/^(#{1,6})\s+(.+)/)
		if (match) {
			const text = match[2].replace(/[#*`[\]]/g, '').trim()
			if (text) {
				items.push({ level: match[1].length, text, id: `heading-${items.length}` })
			}
		}
	}
	tocHeadings.value = items
}

const milkdownRef = ref<{ getMarkdown: () => string } | null>(null)

function onEditorUpdate(markdown: string) {
	onContentChange(markdown, undefined)
	extractHeadings(markdown)
}

function onTitleInput() {
	title.value = title.value.replace(/[/\\:*?"<>|]/g, '')
	onContentChange(milkdownRef.value?.getMarkdown() ?? '', title.value)
}

// ── 下载 ──
function handleDownload() {
	const markdown = milkdownRef.value?.getMarkdown() ?? ''
	const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' })
	const url = URL.createObjectURL(blob)
	const a = document.createElement('a')
	a.href = url
	a.download = `${title.value || '未命名文档'}.md`
	a.click()
	URL.revokeObjectURL(url)
	msgSuccess('已下载')
}

// ── 快速保存快照 ──
async function handleQuickSnapshot() {
	await flushSave()
	const res = await apiCreateSnapshot(docId.value, `手动快照 ${new Date().toLocaleString()}`)
	if (res.success) {
		msgSuccess('快照已保存')
	} else {
		msgError(res.message || '保存快照失败')
	}
}

// ── Presence ──
const onlineUsers = ref<Array<{ id: number; name: string; color: string }>>([])
function onPresenceUpdate(users: typeof onlineUsers.value) {
	onlineUsers.value = users.filter(u => u.id !== currentUserId.value)
}

// ── Ctrl+S 手动保存 ──
function onKeydown(e: KeyboardEvent) {
	if ((e.ctrlKey || e.metaKey) && e.key === 's') {
		e.preventDefault()
		flushSave()
	}
}
onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))

// ── 返回 ──
async function handleBack() {
	await flushSave()
	// PRD: 返回时自动保存快照
	apiCreateSnapshot(docId.value, '自动保存').catch(() => { })
	const from = route.query.from as string | undefined
	if (from === 'personal') {
		router.replace('/personal')
	} else if (from === 'repos') {
		router.replace('/repos')
	} else {
		router.back()
	}
}

// ── 发布 ──
const publishModalVisible = ref(false)
const publishTarget = computed<PersonalDocItem | null>(() => {
	if (!docId.value) return null
	return { id: docId.value, title: title.value, ext: 'md', status: 1 } as PersonalDocItem
})

async function handlePublish() {
	const confirmed = await msgConfirm(
		'提交后将进入审批流程，审批期间文档不可编辑，确认提交？',
		'提交发布',
		{ type: 'warning' },
	)
	if (!confirmed) return
	publishModalVisible.value = true
}

function onPublishSuccess() {
	publishModalVisible.value = false
	router.back()
}

// ── 批注面板 ──
const annotationOpen = ref(false)
const annotationPanelRef = ref<{ refresh: () => void; scrollTo: (id: string) => void; addAnnotation: (item: any) => void } | null>(null)
const activeAnnotationId = ref<string>()
const editorMainRef = ref<HTMLElement | null>(null)

function onAnnotationLocate(item: { id: string }) {
	activeAnnotationId.value = item.id
}

function onAnnotationCreated(item: any) {
	// 展开批注面板并刷新
	annotationOpen.value = true
	annotationPanelRef.value?.addAnnotation(item)
	nextTick(() => annotationPanelRef.value?.scrollTo(item.id))
}

// ── 转移/分享弹窗 ──
const transferModalVisible = ref(false)
const shareModalVisible = ref(false)

function handleTransfer() { transferModalVisible.value = true }
function handleShare() { shareModalVisible.value = true }

// ── 删除草稿 / 取消编辑 ──
const deleting = ref(false)
async function handleDeleteOrCancel() {
	const isDraft = docStatus.value === 1
	const confirmMsg = isDraft
		? '确定删除该草稿？删除后将移至回收站，30 天内可恢复。'
		: '尚未提交审批，取消编辑将不会保存当前的修改，是否确认取消？'
	const confirmTitle = isDraft ? '删除草稿' : '取消编辑'
	const confirmed = await msgConfirm(confirmMsg, confirmTitle, { type: 'warning' })
	if (!confirmed) return
	deleting.value = true
	try {
		const res = await apiDeleteDraft(docId.value)
		if (res.success) {
			msgSuccess(isDraft ? '草稿已删除' : '已取消编辑')
			router.back()
		}
	} finally {
		deleting.value = false
	}
}

// ── 历史快照 ──
const snapshotDrawerVisible = ref(false)
const previewMode = ref(false)
const previewHtml = ref('')
const previewName = ref('')

function onSnapshotPreview(html: string, name: string) {
	previewHtml.value = html
	previewName.value = name
	previewMode.value = true
}

function exitPreview() {
	previewMode.value = false
	previewHtml.value = ''
}

function onSnapshotRestored() {
	snapshotDrawerVisible.value = false
	setTimeout(() => window.location.reload(), 800)
}
</script>

<style>
.editor-shell {
	display: flex;
	flex-direction: column;
	height: 100vh;
	overflow: hidden;
}

.editor-topbar {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 0 16px;
	height: 52px;
	border-bottom: 1px solid var(--df-border);
	background: var(--df-panel);
	flex-shrink: 0;
	gap: 12px;
}

.editor-topbar__left {
	display: flex;
	align-items: center;
	gap: 8px;
	flex: 1;
	min-width: 0;
}

.editor-topbar__right {
	display: flex;
	align-items: center;
	gap: 8px;
	flex-shrink: 0;
}

.editor-back-btn {
	padding: 4px;
}

.editor-title-input {
	flex: 1;
	min-width: 0;
	border: none;
	outline: none;
	background: transparent;
	font-size: 15px;
	font-weight: 600;
	color: var(--df-text);
}

.editor-save-status {
	font-size: 12px;
	color: var(--df-subtext);
	white-space: nowrap;
}

.editor-save-status.is-error {
	color: var(--el-color-danger);
}

.editor-save-status.is-saving {
	color: var(--el-color-primary);
}

.editor-body {
	display: flex;
	flex: 1;
	overflow: hidden;
}

.editor-main {
	flex: 1;
	overflow-y: auto;
	padding: 32px 0;
}

.editor-annotation-aside {
	width: 300px;
	border-left: 1px solid var(--df-border);
	overflow-y: auto;
	flex-shrink: 0;
}

.editor-loading {
	padding: 48px 48px;
}

.editor-preview-banner {
	display: flex;
	align-items: center;
	gap: 12px;
	padding: 6px 24px;
	background: var(--el-color-warning-light-9);
	border-bottom: 1px solid var(--el-color-warning-light-5);
	font-size: 13px;
	color: var(--el-color-warning-dark-2);
	flex-shrink: 0;
}

.editor-preview-content {
	flex: 1;
	overflow-y: auto;
	padding: 48px;
	max-width: 900px;
	margin: 0 auto;
	font-size: 15px;
	line-height: 1.75;
}

.editor-toc-toggle {
	margin-left: 8px;
}

.editor-toc {
	width: 220px;
	border-right: 1px solid var(--df-border);
	display: flex;
	flex-direction: column;
	flex-shrink: 0;
	background: var(--df-surface);
}

.editor-toc__header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 12px 12px 8px;
	font-size: 13px;
	font-weight: 600;
	color: var(--df-subtext);
}

.editor-toc__body {
	flex: 1;
}

.editor-toc__item {
	padding: 4px 12px;
	font-size: 13px;
	line-height: 1.6;
	color: var(--df-text);
	cursor: pointer;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;

	&:hover {
		color: var(--df-primary);
		background: var(--df-primary-soft);
	}
}
</style>
