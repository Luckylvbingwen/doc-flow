<template>
	<Teleport to="body">
		<Transition name="fp-fade">
			<div v-if="visible" class="fp-mask" @click.self="close">
				<div class="fp-shell">
					<!-- 顶栏 -->
					<header class="fp-header">
						<div class="fp-header__left">
							<el-icon :size="18" class="fp-header__icon">
								<Document />
							</el-icon>
							<span class="fp-header__title" :title="title">{{ title || '文档预览' }}</span>
							<span v-if="fileTypeLabel" class="fp-header__badge fp-header__badge--type">
								{{ fileTypeLabel }}
							</span>
							<span v-if="displayVersionNo" class="fp-header__badge fp-header__badge--version">
								{{ displayVersionNo }}
							</span>
						</div>
						<div class="fp-header__right">
							<!-- 版本侧栏切换 -->
							<el-tooltip v-if="versions.length > 0" content="版本记录" placement="bottom">
								<el-button text :class="{ 'is-active': versionOpen }" @click="versionOpen = !versionOpen">
									<el-icon :size="16">
										<Clock />
									</el-icon>
									<span class="fp-annot-label">版本</span>
								</el-button>
							</el-tooltip>
							<!-- 批注切换 -->
							<el-tooltip v-if="docId" content="批注" placement="bottom">
								<el-button text :class="{ 'is-active': annotationOpen }" @click="annotationOpen = !annotationOpen">
									<el-icon :size="16">
										<ChatLineSquare />
									</el-icon>
									<span class="fp-annot-label">批注</span>
									<el-badge v-if="fpAnnotationCount > 0" :value="fpAnnotationCount" :max="99" class="df-anno-badge" />
								</el-button>
							</el-tooltip>
							<el-divider direction="vertical" />
							<!-- 普通模式按钮 -->
							<template v-if="mode === 'normal'">
								<el-tooltip content="下载" placement="bottom">
									<el-button text @click="emit('download')">
										<el-icon :size="16">
											<Download />
										</el-icon>
										<span class="fp-annot-label">下载</span>
									</el-button>
								</el-tooltip>
								<el-tooltip content="打印" placement="bottom">
									<el-button text @click="handlePrint">
										<el-icon :size="16">
											<Printer />
										</el-icon>
										<span class="fp-annot-label">打印</span>
									</el-button>
								</el-tooltip>
							</template>
							<!-- 审批模式按钮 -->
							<template v-if="mode === 'approval'">
								<el-tooltip content="全屏对比" placement="bottom">
									<el-button text @click="emit('compare')">
										<el-icon :size="16">
											<Switch />
										</el-icon>
										<span class="fp-annot-label">全屏对比</span>
									</el-button>
								</el-tooltip>
							</template>
							<el-tooltip content="关闭（ESC）" placement="bottom">
								<el-button text @click="close">
									<el-icon :size="18">
										<Close />
									</el-icon>
								</el-button>
							</el-tooltip>
						</div>
					</header>

					<!-- 主体：左目录 + 预览正文 + 右批注 -->
					<div class="fp-body">
						<!-- 目录面板 -->
						<aside v-if="outline.length > 0" class="fp-outline" :class="{ 'is-collapsed': outlineCollapsed }">
							<div class="fp-outline__head">
								<span v-if="!outlineCollapsed" class="fp-outline__title">目录</span>
								<el-button
text size="small" :title="outlineCollapsed ? '展开目录' : '收起目录'"
									@click="outlineCollapsed = !outlineCollapsed">
									<el-icon :size="14">
										<DArrowRight v-if="outlineCollapsed" />
										<DArrowLeft v-else />
									</el-icon>
								</el-button>
							</div>
							<el-scrollbar v-if="!outlineCollapsed" class="fp-outline__list">
								<a
v-for="item in outline" :key="item.id" class="fp-outline__item"
									:class="[`is-level-${item.level}`, { 'is-active': activeOutlineId === item.id }]"
									@click="scrollToHeading(item.id)">
									{{ item.text }}
								</a>
							</el-scrollbar>
						</aside>

						<!-- 预览正文 -->
						<el-scrollbar ref="scrollerRef" class="fp-content" view-class="fp-content__view">
							<div ref="fpPreviewBodyRef" @click="activeAnnotationId = undefined">
								<DocPreview
class="fp-doc-preview" :file-type="fileType" :html="displayHtml"
									:loading="displayLoading" />
							</div>
						</el-scrollbar>

						<!-- 版本侧栏 -->
						<aside v-if="versionOpen && versions.length > 0" class="fp-version-panel">
							<header class="fp-side-panel__head">
								<el-icon :size="14">
									<Clock />
								</el-icon>
								<span>版本记录 ({{ versions.length }})</span>
								<el-button
v-if="mode === 'normal'" type="primary" text size="small" style="margin-left: auto"
									@click="emit('upload-version')">
									上传新版本
								</el-button>
								<el-button
text size="small" :style="mode !== 'normal' ? 'margin-left: auto' : ''"
									@click="versionOpen = false">
									<el-icon :size="14">
										<Close />
									</el-icon>
								</el-button>
							</header>
							<el-scrollbar class="fp-version-panel__list">
								<div
v-for="v in versions" :key="v.id" class="fp-ver-item"
									:class="{ 'is-active': activeVersionId === v.id }" @click="onVersionClick(v)">
									<div class="fp-ver-item__no">
										{{ v.versionNo }}
										<span v-if="v.isCurrent" class="fp-ver-item__badge">当前</span>
									</div>
									<div class="fp-ver-item__meta">{{ v.uploaderName }} · {{ formatTime(v.createdAt) }}</div>
									<div v-if="v.changeNote" class="fp-ver-item__note">{{ v.changeNote }}</div>
								</div>
							</el-scrollbar>
						</aside>

						<!-- 批注面板 -->
						<aside v-if="annotationOpen && docId" class="fp-annot-panel">
							<AnnotationPanel
:doc-id="docId" :active-annotation-id="activeAnnotationId" @locate="onAnnotationLocate"
								@close="annotationOpen = false" />
						</aside>
					</div>
				</div>
			</div>
		</Transition>

		<!-- 选字批注浮层 -->
		<AnnotationSelector v-if="docId" :doc-id="docId" :container-ref="fpPreviewBodyRef" @created="onAnnotationCreated" />
	</Teleport>
</template>

<script setup lang="ts">
import { Document, Close, ChatLineSquare, Clock, DArrowLeft, DArrowRight, Download, Printer, Switch } from '@element-plus/icons-vue'
import { useOutline } from '~/composables/useOutline'
import { apiPreviewDocument } from '~/api/documents'
import type { VersionInfo } from '~/types/version'
import { formatTime } from '~/utils/format'

const props = withDefaults(defineProps<{
	visible: boolean
	title?: string
	versionNo?: string
	fileType: string
	html?: string
	loading?: boolean
	/** 模式：normal=普通预览, approval=审批预览 */
	mode?: 'normal' | 'approval'
	/** 文档 ID（批注面板需要） */
	docId?: number
	/** 版本列表 */
	versions?: VersionInfo[]
}>(), {
	title: '',
	versionNo: '',
	html: '',
	loading: false,
	mode: 'normal',
	docId: 0,
	versions: () => [],
})

const emit = defineEmits<{
	'update:visible': [val: boolean]
	'download': []
	'compare': []
	'upload-version': []
}>()

const visible = computed({
	get: () => props.visible,
	set: (v: boolean) => emit('update:visible', v),
})

const outlineCollapsed = ref(false)
const annotationOpen = ref(false)
const activeAnnotationId = ref<string>()
const fpPreviewBodyRef = ref<HTMLElement | null>(null)
const fpAnnotationCount = ref(0)

function onAnnotationLocate(item: { id: string }) {
	activeAnnotationId.value = item.id
}

function onAnnotationCreated(_item: any) {
	annotationOpen.value = true
	fpAnnotationCount.value++
}

// 加载批注未解决数量
watch(() => props.visible, async (v) => {
	if (v && props.docId) {
		const { apiGetAnnotations } = await import('~/api/document-editor')
		const res = await apiGetAnnotations(props.docId)
		if (res.success) {
			fpAnnotationCount.value = res.data.length
		}
	}
})

const versionOpen = ref(false)
const activeVersionId = ref<number | null>(null)
const scrollerRef = ref<{ wrapRef?: HTMLElement } | null>(null)

// ── 全屏内部版本切换状态（不影响父页面） ──
const versionHtml = ref<string | null>(null)
const versionLoading = ref(false)
const displayHtml = computed(() => versionHtml.value ?? props.html)
const displayLoading = computed(() => versionLoading.value || props.loading)
const displayVersionNo = computed(() => {
	if (activeVersionId.value) {
		const v = props.versions.find(ver => ver.id === activeVersionId.value)
		if (v) return v.versionNo
	}
	return props.versionNo
})

const { outline, activeOutlineId, rebuildOutline, scrollToHeading } = useOutline(scrollerRef, '.fp-doc-preview')

let onKeyDown: ((e: KeyboardEvent) => void) | null = null

function close() {
	visible.value = false
}

async function onVersionClick(v: VersionInfo) {
	activeVersionId.value = v.id
	if (!props.docId) return
	versionLoading.value = true
	try {
		const res = await apiPreviewDocument(props.docId, v.id)
		if (res.success) versionHtml.value = res.data.html
	} catch {
		// 保持当前预览
	} finally {
		versionLoading.value = false
	}
}

function handlePrint() {
	const content = scrollerRef.value?.wrapRef
	if (!content) return
	const printWindow = window.open('', '_blank')
	if (!printWindow) return
	printWindow.document.write(`<html><head><title>${props.title}</title></head><body>${content.innerHTML}</body></html>`)
	printWindow.document.close()
	printWindow.print()
}

const FILE_TYPE_LABEL: Record<string, string> = {
	md: 'Markdown',
	txt: '纯文本',
	docx: 'Word',
	pdf: 'PDF',
	xlsx: 'Excel',
}

const fileTypeLabel = computed(() => FILE_TYPE_LABEL[props.fileType] || props.fileType.toUpperCase())

/** ESC 关闭 + 锁滚动（仅客户端，SSR 阶段不跑） */
watch(visible, (val) => {
	if (typeof window === 'undefined') return
	if (val) {
		onKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'Escape') close()
		}
		window.addEventListener('keydown', onKeyDown)
		document.body.style.overflow = 'hidden'
		annotationOpen.value = false
		versionOpen.value = false
		const cur = props.versions.find(v => v.isCurrent)
		activeVersionId.value = cur?.id ?? null
		versionHtml.value = null
		nextTick(rebuildOutline)
	} else {
		if (onKeyDown) window.removeEventListener('keydown', onKeyDown)
		onKeyDown = null
		document.body.style.overflow = ''
	}
})

/** html / fileType 变化时重建目录 */
watch(() => [displayHtml.value, props.fileType], () => {
	if (visible.value) nextTick(rebuildOutline)
})

onBeforeUnmount(() => {
	if (onKeyDown) window.removeEventListener('keydown', onKeyDown)
	document.body.style.overflow = ''
})
</script>

<style lang="scss" scoped>
.fp-mask {
	position: fixed;
	inset: 0;
	background: rgba(15, 23, 42, 0.55);
	backdrop-filter: blur(2px);
	z-index: 3000;
	display: flex;
	align-items: center;
	justify-content: center;
}

.fp-fade-enter-active,
.fp-fade-leave-active {
	transition: opacity 0.2s ease;

	.fp-shell {
		transition: transform 0.2s ease;
	}
}

.fp-fade-enter-from,
.fp-fade-leave-to {
	opacity: 0;

	.fp-shell {
		transform: scale(0.985);
	}
}

.fp-shell {
	width: 96vw;
	height: 94vh;
	background: var(--df-panel);
	border-radius: 12px;
	box-shadow: 0 24px 60px rgba(0, 0, 0, 0.35);
	display: flex;
	flex-direction: column;
	overflow: hidden;
}

// ── 顶栏 ──
.fp-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
	padding: 12px 18px;
	border-bottom: 1px solid var(--df-border);
	flex-shrink: 0;
}

.fp-header__left {
	display: flex;
	align-items: center;
	gap: 10px;
	flex: 1;
	min-width: 0;
}

.fp-header__icon {
	color: var(--df-primary);
	flex-shrink: 0;
}

.fp-header__title {
	font-size: 15px;
	font-weight: 600;
	color: var(--df-text);
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.fp-header__badge {
	display: inline-flex;
	align-items: center;
	padding: 2px 8px;
	border-radius: 10px;
	font-size: 11px;
	font-weight: 500;
	flex-shrink: 0;

	&--type {
		background: var(--df-primary-soft);
		color: var(--df-primary);
	}

	&--version {
		background: var(--df-bg);
		color: var(--df-subtext);
		font-variant-numeric: tabular-nums;
	}
}

.fp-header__right {
	display: flex;
	align-items: center;
	gap: 4px;
	flex-shrink: 0;

	.is-active {
		color: var(--df-primary);
		background: var(--df-primary-soft);
	}
}

.fp-annot-label {
	margin-left: 4px;
	font-size: 13px;
}

.fp-annot-badge {
	margin-left: 4px;
	min-width: 18px;
	padding: 0 5px;
	height: 16px;
	background: #ef4444;
	color: #fff;
	border-radius: 8px;
	font-size: 11px;
	display: inline-flex;
	align-items: center;
	justify-content: center;
}

// ── 主体 ──
.fp-body {
	flex: 1;
	min-height: 0;
	display: flex;
}

// ── 目录 ──
.fp-outline {
	flex-shrink: 0;
	width: 240px;
	background: var(--df-surface);
	border-right: 1px solid var(--df-border);
	display: flex;
	flex-direction: column;
	transition: width 0.2s;

	&.is-collapsed {
		width: 36px;
	}
}

.fp-outline__head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 10px 12px;
	border-bottom: 1px solid var(--df-border);
	flex-shrink: 0;
}

.fp-outline__title {
	font-size: 13px;
	font-weight: 600;
	color: var(--df-text);
}

.fp-outline__list {
	flex: 1;
	min-height: 0;
}

.fp-outline__item {
	display: block;
	padding: 6px 14px;
	font-size: 13px;
	color: var(--df-subtext);
	cursor: pointer;
	border-left: 2px solid transparent;
	transition: background 0.15s, color 0.15s, border-color 0.15s;
	line-height: 1.4;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;

	&:hover {
		color: var(--df-primary);
		background: color-mix(in srgb, var(--df-primary) 5%, transparent);
	}

	&.is-active {
		color: var(--df-primary);
		background: var(--df-primary-soft);
		border-left-color: var(--df-primary);
		font-weight: 500;
	}

	&.is-level-2 {
		padding-left: 24px;
		font-size: 12.5px;
	}

	&.is-level-3 {
		padding-left: 34px;
		font-size: 12px;
		color: color-mix(in srgb, var(--df-subtext) 90%, transparent);
	}
}

// ── 内容 ──
.fp-content {
	flex: 1;
	min-width: 0;
	background: var(--df-panel);
}

:deep(.fp-content__view) {
	max-width: 880px;
	margin: 0 auto;
	padding: 32px 48px 80px;
}

:deep(.fp-doc-preview) {
	font-size: 15px;
	line-height: 1.85;

	h1,
	h2,
	h3 {
		scroll-margin-top: 16px;
	}
}

// ── 侧面板通用 ──
.fp-side-panel__head {
	display: flex;
	align-items: center;
	gap: 6px;
	padding: 12px 14px;
	border-bottom: 1px solid var(--df-border);
	font-size: 13px;
	font-weight: 600;
	color: var(--df-text);
	flex-shrink: 0;
}

// ── 批注面板 ──
.fp-annot-panel {
	flex-shrink: 0;
	width: 320px;
	background: var(--df-surface);
	border-left: 1px solid var(--df-border);
	display: flex;
	flex-direction: column;
}

// ── 版本面板 ──
.fp-version-panel {
	flex-shrink: 0;
	width: 280px;
	background: var(--df-surface);
	border-left: 1px solid var(--df-border);
	display: flex;
	flex-direction: column;
}

.fp-version-panel__list {
	flex: 1;
	min-height: 0;
}

.fp-ver-item {
	padding: 10px 14px;
	cursor: pointer;
	border-bottom: 1px solid var(--df-border);
	transition: background 0.15s;

	&:hover {
		background: color-mix(in srgb, var(--df-primary) 5%, transparent);
	}

	&.is-active {
		background: var(--df-primary-soft);
		border-left: 3px solid var(--df-primary);
	}
}

.fp-ver-item__no {
	font-size: 13px;
	font-weight: 600;
	color: var(--df-text);
}

.fp-ver-item__badge {
	display: inline-flex;
	align-items: center;
	padding: 1px 6px;
	border-radius: 8px;
	font-size: 10px;
	font-weight: 500;
	background: var(--df-primary-soft);
	color: var(--df-primary);
	margin-left: 6px;
}

.fp-ver-item__meta {
	font-size: 12px;
	color: var(--df-subtext);
	margin-top: 2px;
}

.fp-ver-item__note {
	font-size: 12px;
	color: var(--df-subtext);
	margin-top: 4px;
	font-style: italic;
}
</style>
