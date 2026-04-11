<template>
	<div
v-show="show" ref="trackRef" class="sync-horizontal-scrollbar" :class="{ visible }"
		@mouseenter="onScrollbarEnter" @mouseleave="onScrollbarLeave" @mousedown="onTrackClick">
		<div ref="thumbRef" class="sync-scrollbar-thumb" :style="thumbStyle" @mousedown.stop="onThumbMouseDown" />
	</div>
</template>

<script setup lang="ts">
import type { TableInstance } from 'element-plus'

const props = defineProps<{
	tableRef?: TableInstance | null
}>()

const trackRef = ref<HTMLElement | null>(null)
const thumbRef = ref<HTMLElement | null>(null)
const show = ref(false)
const visible = ref(false)

// 滚动条 thumb 状态
const thumbLeft = ref(0)
const thumbWidth = ref(0)

const thumbStyle = computed(() => ({
	width: `${thumbWidth.value}px`,
	transform: `translateX(${thumbLeft.value}px)`,
}))

let target: HTMLElement | null = null
let tableContainer: HTMLElement | null = null
let syncHandler: (() => void) | null = null
let observer: MutationObserver | null = null
let showTimer: number | null = null
let hideTimer: number | null = null

/** 获取 el-table 内部的横向滚动容器 */
function getTarget(): HTMLElement | null {
	return props.tableRef?.$el?.querySelector('.el-scrollbar__wrap') ?? null
}

/** 隐藏 el-table 原生横向滚动条 */
function hideNativeScrollbar() {
	const bar = props.tableRef?.$el?.querySelector('.el-scrollbar__bar.is-horizontal') as HTMLElement | null
	if (bar) {
		bar.style.display = 'none'
		bar.style.visibility = 'hidden'
	}
}

/** 根据表格滚动状态更新 thumb 位置和宽度 */
function updateThumb() {
	if (!target || !trackRef.value) return
	const { scrollWidth, clientWidth, scrollLeft } = target
	if (scrollWidth <= clientWidth) {
		show.value = false
		return
	}
	const trackWidth = trackRef.value.clientWidth
	thumbWidth.value = Math.max((clientWidth / scrollWidth) * trackWidth, 30)
	thumbLeft.value = (scrollLeft / (scrollWidth - clientWidth)) * (trackWidth - thumbWidth.value)
}

/** 更新可见性 + thumb */
function updateState() {
	nextTick(() => {
		target = getTarget()
		if (target && trackRef.value) {
			show.value = target.scrollWidth > target.clientWidth
			hideNativeScrollbar()
			updateThumb()
		}
	})
}

// ---- hover 显示/隐藏 ----

function clearTimers() {
	if (showTimer) { clearTimeout(showTimer); showTimer = null }
	if (hideTimer) { clearTimeout(hideTimer); hideTimer = null }
}

function onTableEnter() {
	clearTimers()
	if (show.value) {
		showTimer = window.setTimeout(() => { visible.value = true }, 100)
	}
}

function onTableLeave() {
	clearTimers()
	hideTimer = window.setTimeout(() => { visible.value = false }, 300)
}

function onScrollbarEnter() {
	clearTimers()
	visible.value = true
}

function onScrollbarLeave() {
	clearTimers()
	hideTimer = window.setTimeout(() => { visible.value = false }, 300)
}

// ---- 拖拽 thumb ----

function onThumbMouseDown(e: MouseEvent) {
	e.preventDefault()
	if (!target || !trackRef.value) return

	const startX = e.clientX
	const startScrollLeft = target.scrollLeft
	const trackWidth = trackRef.value.clientWidth
	const scrollRange = target.scrollWidth - target.clientWidth
	const thumbRange = trackWidth - thumbWidth.value

	const onMove = (ev: MouseEvent) => {
		const delta = ev.clientX - startX
		const ratio = delta / thumbRange
		target!.scrollLeft = startScrollLeft + ratio * scrollRange
	}
	const onUp = () => {
		document.removeEventListener('mousemove', onMove)
		document.removeEventListener('mouseup', onUp)
	}
	document.addEventListener('mousemove', onMove)
	document.addEventListener('mouseup', onUp)
}

/** 点击 track 空白区域跳转 */
function onTrackClick(e: MouseEvent) {
	if (!target || !trackRef.value || e.target === thumbRef.value) return
	const rect = trackRef.value.getBoundingClientRect()
	const clickRatio = (e.clientX - rect.left) / rect.width
	target.scrollLeft = clickRatio * (target.scrollWidth - target.clientWidth)
}

// ---- 表格滚动 → 同步 thumb ----

function setupSync() {
	target = getTarget()
	if (!target) return

	if (syncHandler) target.removeEventListener('scroll', syncHandler)
	syncHandler = () => updateThumb()
	target.addEventListener('scroll', syncHandler)

	if (observer) observer.disconnect()
	observer = new MutationObserver(updateState)
	observer.observe(target, { childList: true, subtree: true, attributes: true })
}

function bindTableHover() {
	unbindTableHover()
	tableContainer = props.tableRef?.$el ?? null
	if (tableContainer) {
		tableContainer.addEventListener('mouseenter', onTableEnter)
		tableContainer.addEventListener('mouseleave', onTableLeave)
	}
}

function unbindTableHover() {
	if (tableContainer) {
		tableContainer.removeEventListener('mouseenter', onTableEnter)
		tableContainer.removeEventListener('mouseleave', onTableLeave)
		tableContainer = null
	}
}

/** 初始化，带重试 */
function init(retry = 5) {
	target = getTarget()
	if (target && trackRef.value) {
		show.value = target.scrollWidth > target.clientWidth
		hideNativeScrollbar()
		updateThumb()
		setupSync()
		bindTableHover()
	} else if (retry > 0) {
		setTimeout(() => init(retry - 1), 150)
	}
}

onMounted(() => {
	nextTick(() => init())
	window.addEventListener('resize', updateState)
})

onBeforeUnmount(() => {
	if (target && syncHandler) target.removeEventListener('scroll', syncHandler)
	window.removeEventListener('resize', updateState)
	unbindTableHover()
	clearTimers()
	if (observer) observer.disconnect()
})

watch(() => props.tableRef, () => {
	nextTick(() => init())
})
</script>

<style scoped lang="scss">
.sync-horizontal-scrollbar {
	position: relative;
	width: 100%;
	height: 8px;
	opacity: 0;
	transition: opacity 0.3s ease;
	cursor: pointer;

	&.visible {
		opacity: 1;
	}
}

.sync-scrollbar-thumb {
	position: absolute;
	top: 1px;
	left: 0;
	height: 6px;
	border-radius: 3px;
	background-color: rgba(144, 147, 153, 0.3);
	transition: background-color 0.2s;
	cursor: pointer;

	&:hover {
		background-color: rgba(144, 147, 153, 0.5);
	}
}
</style>
