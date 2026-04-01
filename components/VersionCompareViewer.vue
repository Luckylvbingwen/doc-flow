<template>
	<Teleport to="body">
		<Transition name="fade">
			<div v-if="visible" class="df-compare-overlay">
				<!-- 顶部工具栏 -->
				<div class="df-compare-toolbar">
					<div class="ct-title">
						<el-icon :size="18" color="var(--df-primary)">
							<Switch />
						</el-icon>
						版本对比 — {{ data?.fileName }}
					</div>
					<span class="ct-meta">
						{{ data?.newVersion.versionNo }} vs
						{{ data?.oldVersion.versionNo }}
						·
						{{ fileTypeLabel }}
					</span>
					<div class="ct-actions">
						<el-button size="small" @click="emit('viewFile')">
							<el-icon>
								<View />
							</el-icon>
							查看完整文件
						</el-button>
						<el-button size="small" circle @click="emit('close')">
							<el-icon>
								<Close />
							</el-icon>
						</el-button>
					</div>
				</div>

				<!-- 对比模式切换栏 -->
				<div class="df-compare-mode-bar">
					<span class="mode-label">对比模式：</span>
					<button
class="df-compare-mode-btn" :class="{ active: mode === 'side-by-side' }"
						@click="mode = 'side-by-side'">
						↔ 左右并排
					</button>
					<button class="df-compare-mode-btn" :class="{ active: mode === 'top-bottom' }" @click="mode = 'top-bottom'">
						↕ 上下对比
					</button>
					<button
v-if="data?.fileType === 'pdf'" class="df-compare-mode-btn" :class="{ active: mode === 'overlay' }"
						@click="mode = 'overlay'">
						▭ 叠加对比
					</button>
				</div>

				<!-- 对比内容区 -->
				<div v-if="data" class="df-compare-body" :class="{ 'top-bottom': mode === 'top-bottom' }">
					<!-- 新版面板 -->
					<div class="compare-pane">
						<div class="compare-pane-header">
							<span class="ver-badge ver-new">
								{{ data.newVersion.versionNo }} 新版本
							</span>
							{{ data.fileName }}
						</div>
						<div ref="newPaneRef" class="compare-canvas" @scroll="syncScroll('new')">
							<div class="compare-doc">
								<div class="compare-doc-page" v-html="sanitize(data.newVersion.html)" />
							</div>
						</div>
					</div>

					<!-- 旧版面板 -->
					<div class="compare-pane">
						<div class="compare-pane-header">
							<span class="ver-badge ver-old">
								{{ data.oldVersion.versionNo }} 旧版本
							</span>
							{{ data.fileName }}
						</div>
						<div ref="oldPaneRef" class="compare-canvas" @scroll="syncScroll('old')">
							<div class="compare-doc">
								<div class="compare-doc-page" v-html="sanitize(data.oldVersion.html)" />
							</div>
						</div>
					</div>
				</div>

				<!-- 加载中 -->
				<div
v-if="loading" style="
						flex: 1;
						display: flex;
						flex-direction: column;
						align-items: center;
						justify-content: center;
						gap: 12px;
						color: var(--df-subtext);
						font-size: 13px;
					">
					<el-icon class="is-loading" :size="32" color="var(--df-primary)">
						<Loading />
					</el-icon>
					<span>正在计算版本差异…</span>
				</div>
			</div>
		</Transition>
	</Teleport>
</template>

<script setup lang="ts">
import { Close, View, Loading, Switch } from '@element-plus/icons-vue'
import type { CompareMode, CompareResult } from '~/types/version'

const { sanitize } = useSanitize()

const props = defineProps<{
	visible: boolean
	data: CompareResult | null
	loading?: boolean
}>()

const emit = defineEmits<{
	close: []
	viewFile: []
}>()

const FILE_TYPE_LABELS: Record<string, string> = {
	md: 'Markdown',
	pdf: 'PDF',
	docx: 'Word',
	xlsx: 'Excel',
	txt: '纯文本',
}
const fileTypeLabel = computed(
	() => FILE_TYPE_LABELS[props.data?.fileType || ''] || props.data?.fileType?.toUpperCase() || ''
)
const mode = ref<CompareMode>('side-by-side')
const newPaneRef = ref<HTMLElement | null>(null)
const oldPaneRef = ref<HTMLElement | null>(null)

// 滚动同步
let syncing = false
function syncScroll(source: 'new' | 'old') {
	if (syncing) return
	syncing = true
	const from = source === 'new' ? newPaneRef.value : oldPaneRef.value
	const to = source === 'new' ? oldPaneRef.value : newPaneRef.value
	if (from && to) {
		to.scrollTop = from.scrollTop
		to.scrollLeft = from.scrollLeft
	}
	nextTick(() => {
		syncing = false
	})
}

// ESC 关闭
function onKeydown(e: KeyboardEvent) {
	if (e.key === 'Escape') {
		emit('close')
	}
}

onMounted(() => {
	document.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
	document.removeEventListener('keydown', onKeydown)
})
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
	transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
	opacity: 0;
}
</style>
