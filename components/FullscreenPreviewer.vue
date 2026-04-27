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
							<span v-if="versionNo" class="fp-header__badge fp-header__badge--version">
								{{ versionNo }}
							</span>
						</div>
						<div class="fp-header__right">
							<el-tooltip content="批注（即将上线）" placement="bottom">
								<el-button text :class="{ 'is-active': annotationOpen }" @click="annotationOpen = !annotationOpen">
									<el-icon :size="16">
										<ChatLineSquare />
									</el-icon>
									<span class="fp-annot-label">批注</span>
									<span v-if="annotationCount > 0" class="fp-annot-badge">{{ annotationCount }}</span>
								</el-button>
							</el-tooltip>
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
							<DocPreview class="fp-doc-preview" :file-type="fileType" :html="html" :loading="loading" />
						</el-scrollbar>

						<!-- 批注面板（占位） -->
						<aside v-if="annotationOpen" class="fp-annot-panel">
							<header class="fp-annot-panel__head">
								<el-icon :size="14">
									<ChatLineSquare />
								</el-icon>
								<span>批注</span>
								<el-button text size="small" style="margin-left: auto" @click="annotationOpen = false">
									<el-icon :size="14">
										<Close />
									</el-icon>
								</el-button>
							</header>
							<div class="fp-annot-panel__body">
								<el-icon :size="36" color="var(--df-subtext)" style="opacity: 0.3">
									<ChatLineSquare />
								</el-icon>
								<p class="fp-annot-panel__hint">批注功能即将上线</p>
								<p class="fp-annot-panel__sub">将随评论 / 标注模块一并接入</p>
							</div>
						</aside>
					</div>
				</div>
			</div>
		</Transition>
	</Teleport>
</template>

<script setup lang="ts">
import { Document, Close, ChatLineSquare, DArrowLeft, DArrowRight } from '@element-plus/icons-vue'

interface OutlineItem {
	id: string
	text: string
	level: 1 | 2 | 3
}

const props = withDefaults(defineProps<{
	/** v-model:visible */
	visible: boolean
	/** 文档名（顶栏标题） */
	title?: string
	/** 当前版本号（顶栏徽章） */
	versionNo?: string
	/** 文件类型（DocPreview 透传） */
	fileType: string
	/** 服务端预渲染 HTML（DocPreview 透传） */
	html?: string
	loading?: boolean
	/** 批注数量（顶栏角标占位，本期恒 0） */
	annotationCount?: number
}>(), {
	title: '',
	versionNo: '',
	html: '',
	loading: false,
	annotationCount: 0,
})

const emit = defineEmits<{
	'update:visible': [val: boolean]
}>()

const visible = computed({
	get: () => props.visible,
	set: (v: boolean) => emit('update:visible', v),
})

const outlineCollapsed = ref(false)
const annotationOpen = ref(false)
const outline = ref<OutlineItem[]>([])
const activeOutlineId = ref<string | null>(null)
const scrollerRef = ref<{ wrapRef?: HTMLElement } | null>(null)

let observer: IntersectionObserver | null = null
let onKeyDown: ((e: KeyboardEvent) => void) | null = null

function close() {
	visible.value = false
}

const FILE_TYPE_LABEL: Record<string, string> = {
	md: 'Markdown',
	txt: '纯文本',
	docx: 'Word',
	pdf: 'PDF',
	xlsx: 'Excel',
}

const fileTypeLabel = computed(() => FILE_TYPE_LABEL[props.fileType] || props.fileType.toUpperCase())

/**
 * 从已渲染 HTML 抽取 H1-H3 → outline 列表，给每个节点植入唯一 id 锚点
 * 用 nextTick 等 v-html 完成 DOM 写入再操作
 */
async function rebuildOutline() {
	outline.value = []
	activeOutlineId.value = null

	if (!props.visible) return
	await nextTick()

	const container = scrollerRef.value?.wrapRef as HTMLElement | undefined
	if (!container) return

	const headings = Array.from(container.querySelectorAll('.fp-doc-preview h1, .fp-doc-preview h2, .fp-doc-preview h3'))
	const items: OutlineItem[] = []

	headings.forEach((h, idx) => {
		const el = h as HTMLElement
		if (!el.id) el.id = `fp-h-${idx}`
		const level = (parseInt(el.tagName.slice(1)) as 1 | 2 | 3) || 1
		items.push({
			id: el.id,
			text: (el.textContent || '').trim() || `(无标题 #${idx + 1})`,
			level,
		})
	})
	outline.value = items
	if (items.length > 0) activeOutlineId.value = items[0].id

	setupObserver(headings as HTMLElement[])
}

function setupObserver(headings: HTMLElement[]) {
	teardownObserver()
	const container = scrollerRef.value?.wrapRef as HTMLElement | undefined
	if (!container || headings.length === 0) return

	observer = new IntersectionObserver(
		(entries) => {
			// 取第一个进入视口的 heading 作为 active
			const visibleEntries = entries.filter(e => e.isIntersecting)
			if (visibleEntries.length === 0) return
			visibleEntries.sort(
				(a, b) => a.boundingClientRect.top - b.boundingClientRect.top,
			)
			activeOutlineId.value = (visibleEntries[0].target as HTMLElement).id
		},
		{
			root: container,
			rootMargin: '-10% 0px -70% 0px',
			threshold: 0,
		},
	)
	headings.forEach(h => observer!.observe(h))
}

function teardownObserver() {
	observer?.disconnect()
	observer = null
}

function scrollToHeading(id: string) {
	const container = scrollerRef.value?.wrapRef as HTMLElement | undefined
	const target = container?.querySelector<HTMLElement>(`#${CSS.escape(id)}`)
	if (!target) return
	target.scrollIntoView({ behavior: 'smooth', block: 'start' })
	activeOutlineId.value = id
}

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
		nextTick(rebuildOutline)
	} else {
		if (onKeyDown) window.removeEventListener('keydown', onKeyDown)
		onKeyDown = null
		document.body.style.overflow = ''
		teardownObserver()
	}
})

/** html / fileType 变化时重建目录 */
watch(() => [props.html, props.fileType], () => {
	if (visible.value) nextTick(rebuildOutline)
})

onBeforeUnmount(() => {
	if (onKeyDown) window.removeEventListener('keydown', onKeyDown)
	document.body.style.overflow = ''
	teardownObserver()
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
	background: #fff;
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

// ── 批注面板占位 ──
.fp-annot-panel {
	flex-shrink: 0;
	width: 320px;
	background: var(--df-surface);
	border-left: 1px solid var(--df-border);
	display: flex;
	flex-direction: column;
}

.fp-annot-panel__head {
	display: flex;
	align-items: center;
	gap: 6px;
	padding: 12px 14px;
	border-bottom: 1px solid var(--df-border);
	font-size: 13px;
	font-weight: 600;
	color: var(--df-text);
}

.fp-annot-panel__body {
	flex: 1;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 8px;
	padding: 24px;
	text-align: center;
}

.fp-annot-panel__hint {
	font-size: 13px;
	color: var(--df-text);
	margin: 0;
}

.fp-annot-panel__sub {
	font-size: 12px;
	color: var(--df-subtext);
	margin: 0;
}
</style>
