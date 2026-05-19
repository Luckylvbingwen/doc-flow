<template>
	<!-- 触发按钮：header 中的搜索入口 -->
	<button class="gs-trigger" type="button" @click="open">
		<el-icon :size="16">
			<Search />
		</el-icon>
		<span class="gs-trigger__text">搜索文档...</span>
		<kbd class="gs-trigger__kbd">/</kbd>
	</button>

	<!-- 搜索弹层（Teleport 到 body，避免被 header overflow 裁切） -->
	<Teleport to="body">
		<Transition name="gs-overlay">
			<div v-if="visible" class="gs-overlay" @mousedown.self="close">
				<div class="gs-dialog" @keydown.escape="close">
					<!-- 搜索输入 -->
					<div class="gs-dialog__header">
						<el-icon class="gs-dialog__search-icon" :size="18">
							<Search />
						</el-icon>
						<input ref="inputRef" v-model="keyword" class="gs-dialog__input" placeholder="搜索文档名或组名..." @input="onInput">
						<button v-if="keyword" class="gs-dialog__clear" type="button" @click="clearKeyword">
							<el-icon :size="14">
								<CircleClose />
							</el-icon>
						</button>
						<button class="gs-dialog__close" type="button" @click="close">
							<kbd>Esc</kbd>
						</button>
					</div>

					<!-- 搜索结果 -->
					<div class="gs-dialog__body">
						<div v-if="!keyword.trim()" class="gs-dialog__empty">
							<el-icon :size="32" color="var(--df-subtext)">
								<Search />
							</el-icon>
							<p>输入关键词搜索文档或组</p>
						</div>
						<div v-else-if="loading" class="gs-dialog__empty">
							<el-icon class="is-loading" :size="24">
								<Loading />
							</el-icon>
							<p>搜索中...</p>
						</div>
						<div v-else-if="groups.length === 0 && documents.length === 0" class="gs-dialog__empty">
							<p>未找到与 "<strong>{{ keyword }}</strong>" 相关的内容</p>
						</div>
						<el-scrollbar v-else max-height="400px">
							<div class="gs-section__hint">仅显示有权限的内容</div>
							<div v-if="groups.length > 0" class="gs-section">
								<div class="gs-section__title">组（{{ groups.length }}）</div>
								<div
v-for="(g, gi) in groups" :key="g.id" class="gs-item"
									:class="{ 'gs-item--active': activeIndex === gi }" @click="onGroupClick(g)"
									@mouseenter="activeIndex = gi">
									<el-icon class="gs-item__icon" color="var(--el-color-primary)">
										<Folder />
									</el-icon>
									<div class="gs-item__content">
										<span class="gs-item__title">{{ g.name }}</span>
										<el-tag size="small" type="info" class="gs-item__badge">{{ scopeLabel(g.scopeType) }}</el-tag>
										<span v-if="g.description" class="gs-item__desc">{{ g.description }}</span>
									</div>
									<el-icon class="gs-item__arrow" :size="12">
										<ArrowRight />
									</el-icon>
								</div>
							</div>
							<div v-if="documents.length > 0" class="gs-section">
								<div class="gs-section__title">文档（{{ documents.length }}）</div>
								<div
v-for="(d, di) in documents" :key="d.id" class="gs-item"
									:class="{ 'gs-item--active': activeIndex === groups.length + di }" @click="onDocClick(d)"
									@mouseenter="activeIndex = groups.length + di">
									<el-icon class="gs-item__icon" color="var(--el-color-warning)">
										<Document />
									</el-icon>
									<div class="gs-item__content">
										<span class="gs-item__title">{{ d.title }}</span>
										<span v-if="d.versionNo" class="gs-item__version">v{{ d.versionNo }}</span>
										<span class="gs-item__desc">{{ d.groupName }}</span>
									</div>
									<el-icon class="gs-item__arrow" :size="12">
										<ArrowRight />
									</el-icon>
								</div>
							</div>
						</el-scrollbar>
					</div>
				</div>
			</div>
		</Transition>
	</Teleport>
</template>

<script setup lang="ts">
import { Search, CircleClose, Folder, Document, ArrowRight, Loading } from '@element-plus/icons-vue'
import { apiSearch } from '~/api/search'
import type { SearchResult } from '~/api/search'

const router = useRouter()
const visible = ref(false)
const keyword = ref('')
const loading = ref(false)
const activeIndex = ref(-1)
const groups = ref<SearchResult['groups']>([])
const documents = ref<SearchResult['documents']>([])
const inputRef = ref<HTMLInputElement>()

function scopeLabel(scopeType: number) {
	if (scopeType === 1) return '公司'
	if (scopeType === 2) return '部门'
	if (scopeType === 3) return '产品线'
	return ''
}

let debounceTimer: ReturnType<typeof setTimeout>

function open() {
	visible.value = true
	nextTick(() => inputRef.value?.focus())
}

function close() {
	visible.value = false
	keyword.value = ''
	groups.value = []
	documents.value = []
	activeIndex.value = -1
}

function clearKeyword() {
	keyword.value = ''
	groups.value = []
	documents.value = []
	activeIndex.value = -1
	inputRef.value?.focus()
}

async function doSearch(q: string) {
	loading.value = true
	try {
		const res = await apiSearch(q)
		if (res.success) {
			groups.value = res.data.groups
			documents.value = res.data.documents
			activeIndex.value = -1
		}
	} finally {
		loading.value = false
	}
}

function onInput() {
	clearTimeout(debounceTimer)
	const val = keyword.value.trim()
	if (!val) {
		groups.value = []
		documents.value = []
		loading.value = false
		return
	}
	loading.value = true
	debounceTimer = setTimeout(() => doSearch(val), 300)
}

function onGroupClick(g: SearchResult['groups'][0]) {
	router.push({ path: '/docs', query: { groupId: String(g.id) } })
	close()
}

function onDocClick(d: SearchResult['documents'][0]) {
	router.push(`/docs/file/${d.id}`)
	close()
}

// "/" 全局快捷键（与 GitHub / YouTube 一致，不与浏览器冲突）
function handleKeydown(e: KeyboardEvent) {
	if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) {
		const tag = (e.target as HTMLElement)?.tagName
		// 如果焦点已在输入类元素中，不拦截
		if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) return
		e.preventDefault()
		open()
	}
}

onMounted(() => document.addEventListener('keydown', handleKeydown))
onUnmounted(() => document.removeEventListener('keydown', handleKeydown))
</script>

<style lang="scss">
/* ── 触发按钮（unscoped：需被父级 .pf-topbar-actions 覆盖） ── */
.gs-trigger {
	display: inline-flex;
	align-items: center;
	gap: 6px;
	height: 32px;
	padding: 0 10px;
	border: 1px solid transparent;
	border-radius: 8px;
	background: transparent;
	color: var(--df-subtext);
	font-size: 13px;
	cursor: pointer;
	transition: all 0.2s;
	white-space: nowrap;

	&:hover {
		color: var(--df-primary);
		background: var(--df-primary-soft);
	}
}

.gs-trigger__text {
	max-width: 100px;
	overflow: hidden;
	text-overflow: ellipsis;
}

.gs-trigger__kbd {
	font-size: 11px;
	padding: 1px 5px;
	border: 1px solid currentcolor;
	border-radius: 4px;
	background: transparent;
	color: inherit;
	font-family: inherit;
	line-height: 1.4;
	opacity: 0.5;
}

/* 顶栏深色模式适配 */
.pf-topbar-actions .gs-trigger {
	color: #94a3b8;

	&:hover {
		color: #e2e8f0;
		background: rgba(255, 255, 255, 0.08);
	}
}
</style>

<style lang="scss" scoped>
/* ── 弹层 ── */
.gs-overlay {
	position: fixed;
	inset: 0;
	z-index: 2000;
	display: flex;
	align-items: flex-start;
	justify-content: center;
	padding-top: 12vh;
	background: rgb(0 0 0 / 40%);
	backdrop-filter: blur(2px);
}

.gs-dialog {
	width: 560px;
	max-width: calc(100vw - 40px);
	background: var(--df-panel);
	border: 1px solid var(--df-border);
	border-radius: 12px;
	box-shadow: 0 16px 48px rgb(0 0 0 / 20%);
	overflow: hidden;
}

/* ── 搜索头部 ── */
.gs-dialog__header {
	display: flex;
	align-items: center;
	gap: 10px;
	padding: 14px 16px;
	border-bottom: 1px solid var(--df-border);
}

.gs-dialog__search-icon {
	color: var(--df-primary);
	flex-shrink: 0;
}

.gs-dialog__input {
	flex: 1;
	border: none;
	outline: none;
	background: transparent;
	font-size: 15px;
	color: var(--df-text);
	line-height: 1.5;

	&::placeholder {
		color: var(--df-subtext);
	}
}

.gs-dialog__clear {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 24px;
	height: 24px;
	border: none;
	background: transparent;
	color: var(--df-subtext);
	cursor: pointer;
	border-radius: 4px;
	flex-shrink: 0;

	&:hover {
		color: var(--df-text);
		background: var(--df-surface);
	}
}

.gs-dialog__close {
	display: flex;
	align-items: center;
	border: none;
	background: transparent;
	cursor: pointer;
	flex-shrink: 0;

	kbd {
		font-size: 11px;
		padding: 2px 6px;
		border: 1px solid var(--df-border);
		border-radius: 4px;
		background: var(--df-surface);
		color: var(--df-subtext);
		font-family: inherit;
	}
}

/* ── 搜索结果区 ── */
.gs-dialog__body {
	min-height: 120px;
	max-height: 460px;
}

.gs-dialog__empty {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 8px;
	padding: 40px 20px;
	color: var(--df-subtext);
	font-size: 13px;

	p {
		margin: 0;
	}
}

/* ── 分组标题 ── */
.gs-section+.gs-section {
	border-top: 1px solid var(--df-border);
}

.gs-section__title {
	padding: 10px 16px 4px;
	font-size: 11px;
	font-weight: 600;
	color: var(--df-subtext);
	letter-spacing: 0.04em;
}

/* ── 结果项 ── */
.gs-item {
	display: flex;
	align-items: center;
	gap: 10px;
	padding: 10px 16px;
	cursor: pointer;
	transition: background 0.12s;

	&:hover,
	&--active {
		background: var(--df-primary-soft);
	}
}

.gs-item__icon {
	flex-shrink: 0;
}

.gs-item__content {
	flex: 1;
	min-width: 0;
	display: flex;
	flex-direction: column;
	gap: 2px;
}

.gs-item__title {
	font-size: 14px;
	color: var(--df-text);
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.gs-item__desc {
	font-size: 12px;
	color: var(--df-subtext);
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.gs-item__badge {
	margin-left: 6px;
	font-size: 11px;
	vertical-align: middle;
}

.gs-item__version {
	margin-left: 6px;
	font-size: 11px;
	color: var(--el-color-primary);
	font-weight: 500;
}

.gs-section__hint {
	padding: 6px 16px;
	font-size: 12px;
	color: var(--df-subtext);
	background: var(--df-surface);
	border-bottom: 1px solid var(--df-border);
}

.gs-item__arrow {
	flex-shrink: 0;
	color: var(--df-subtext);
	opacity: 0;
	transition: opacity 0.15s;

	.gs-item:hover &,
	.gs-item--active & {
		opacity: 1;
	}
}

/* ── 进入/离开动画 ── */
.gs-overlay-enter-active {
	transition: opacity 0.2s ease;

	.gs-dialog {
		transition: transform 0.2s ease, opacity 0.2s ease;
	}
}

.gs-overlay-leave-active {
	transition: opacity 0.15s ease;

	.gs-dialog {
		transition: transform 0.15s ease, opacity 0.15s ease;
	}
}

.gs-overlay-enter-from {
	opacity: 0;

	.gs-dialog {
		transform: scale(0.96) translateY(-8px);
		opacity: 0;
	}
}

.gs-overlay-leave-to {
	opacity: 0;

	.gs-dialog {
		transform: scale(0.96) translateY(-8px);
		opacity: 0;
	}
}
</style>
