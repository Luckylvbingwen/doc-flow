<template>
	<Teleport to="body">
		<!-- 选区浮层：添加批注按钮 -->
		<div v-if="showFloating" class="annotation-floating" :style="floatingStyle" @mousedown.prevent>
			<button class="annotation-floating__btn" @click="onClickAdd">添加批注</button>
		</div>

		<!-- 批注输入面板 -->
		<div v-if="showInput" class="annotation-input-panel" :style="inputStyle" @mousedown.stop>
			<div class="annotation-input-panel__quote">
				"{{ displayQuote }}"
			</div>
			<el-input
ref="inputRef" v-model="content" type="textarea" :rows="3" placeholder="输入批注内容，@ 可提及用户" maxlength="1000"
				show-word-limit autofocus @input="onTextInput" @keydown="onTextKeydown" />
			<MentionPopup ref="mentionRef" :textarea-el="textareaEl" @select="onMentionSelect" />
			<div class="annotation-input-panel__actions">
				<el-button size="small" @click="cancel">取消</el-button>
				<el-button size="small" type="primary" :loading="submitting" @click="submit">提交批注</el-button>
			</div>
		</div>
	</Teleport>
</template>

<script setup lang="ts">
import { apiCreateAnnotation } from '~/api/document-editor'
import type { MentionUser } from '~/api/document-editor'
import type { AnnotationItem } from '~/types/document-editor'
import { useAuthStore } from '~/stores/auth'

const props = defineProps<{
	docId: number
	/** 要监听选区的容器元素 */
	containerRef: HTMLElement | null
}>()

const emit = defineEmits<{
	'created': [item: AnnotationItem]
}>()

const { msgSuccess, msgError } = useNotify()
const authStore = useAuthStore()

const showFloating = ref(false)
const showInput = ref(false)
const floatingStyle = ref<Record<string, string>>({})
const inputStyle = ref<Record<string, string>>({})
const quoteText = ref('')
const content = ref('')
const submitting = ref(false)
const inputRef = ref<{ focus: () => void; textarea?: HTMLTextAreaElement } | null>(null)
const mentionRef = ref<{ handleInput: () => void; handleKeydown: (e: KeyboardEvent) => void; hide: () => void } | null>(null)

// @提及
const mentionedUserIds = ref<number[]>([])
const textareaEl = computed(() => inputRef.value?.textarea ?? null)

// 选区信息，创建批注时作为 anchorData
const anchorData = ref<Record<string, unknown>>({})

const displayQuote = computed(() => {
	if (quoteText.value.length > 100) return quoteText.value.slice(0, 100) + '...'
	return quoteText.value
})

let hideTimer: ReturnType<typeof setTimeout> | null = null

function onMouseUp() {
	if (showInput.value) return // 输入面板打开时不处理

	const sel = window.getSelection()
	if (!sel || sel.isCollapsed || !sel.rangeCount) {
		showFloating.value = false
		return
	}

	const text = sel.toString().trim()
	if (text.length < 1 || text.length > 500) {
		showFloating.value = false
		return
	}

	// 确认选区在容器内
	const range = sel.getRangeAt(0)
	if (!props.containerRef?.contains(range.commonAncestorContainer)) {
		showFloating.value = false
		return
	}

	quoteText.value = text

	// 计算 anchorData（用于高亮还原）
	const startNode = range.startContainer
	const textContent = startNode.textContent || ''
	anchorData.value = {
		startOffset: range.startOffset,
		endOffset: range.endOffset,
		prefix: textContent.slice(Math.max(0, range.startOffset - 20), range.startOffset),
		suffix: textContent.slice(range.endOffset, range.endOffset + 20),
		text,
	}

	// 定位浮层（含边缘碰撞检测）
	const rect = range.getBoundingClientRect()
	const btnWidth = 90 // 按钮大致宽度
	let left = rect.left + rect.width / 2
	let top = rect.top - 45

	// 顶部越界：移到选区下方
	if (top < 10) top = rect.bottom + 10
	// 左右越界
	if (left - btnWidth / 2 < 10) left = btnWidth / 2 + 10
	if (left + btnWidth / 2 > window.innerWidth - 10) left = window.innerWidth - btnWidth / 2 - 10

	floatingStyle.value = {
		position: 'fixed',
		left: `${left}px`,
		top: `${top}px`,
		zIndex: '9999',
	}
	showFloating.value = true

	// 10秒自动隐藏
	if (hideTimer) clearTimeout(hideTimer)
	hideTimer = setTimeout(() => { showFloating.value = false }, 10000)
}

function onClickAdd() {
	showFloating.value = false
	if (hideTimer) clearTimeout(hideTimer)

	// 计算输入面板位置（使用浮层位置附近）
	const rect = document.getSelection()?.getRangeAt(0)?.getBoundingClientRect()
	if (rect) {
		inputStyle.value = {
			position: 'fixed',
			left: `${Math.min(rect.left, window.innerWidth - 360)}px`,
			top: `${rect.bottom + 10}px`,
			zIndex: '9999',
		}
	}

	showInput.value = true
	content.value = ''
	nextTick(() => inputRef.value?.focus?.())
}

function cancel() {
	showInput.value = false
	content.value = ''
	mentionedUserIds.value = []
	mentionRef.value?.hide()
}

function onTextInput() {
	mentionRef.value?.handleInput()
}

function onTextKeydown(e: KeyboardEvent | Event) {
	mentionRef.value?.handleKeydown(e as KeyboardEvent)
}

function onMentionSelect(user: MentionUser, replaceStart: number, replaceEnd: number) {
	// 替换 @keyword 为 @name
	const before = content.value.slice(0, replaceStart)
	const after = content.value.slice(replaceEnd)
	content.value = `${before}@${user.name} ${after}`
	// 记录用户 ID（去重）
	if (!mentionedUserIds.value.includes(user.id)) {
		mentionedUserIds.value.push(user.id)
	}
	// 移动光标到插入文字后
	nextTick(() => {
		const pos = replaceStart + user.name.length + 2 // @name + space
		const el = textareaEl.value
		if (el) {
			el.selectionStart = pos
			el.selectionEnd = pos
			el.focus()
		}
	})
}

async function submit() {
	if (!content.value.trim()) {
		msgError('请输入批注内容')
		return
	}
	submitting.value = true
	const trimmedContent = content.value.trim()
	try {
		const res = await apiCreateAnnotation(props.docId, {
			content: trimmedContent,
			quoteText: quoteText.value,
			anchorData: anchorData.value,
			mentionedUserIds: mentionedUserIds.value.length > 0 ? mentionedUserIds.value : undefined,
		})
		if (res.success && res.data) {
			msgSuccess('批注已添加')
			// 构造完整 AnnotationItem 供父组件使用
			const item: AnnotationItem = {
				id: (res.data as any).id,
				content: trimmedContent,
				quoteText: quoteText.value,
				anchorData: anchorData.value,
				authorName: authStore.user?.name || '',
				authorAvatar: authStore.user?.avatar || null,
				createdAt: Date.now(),
				status: 1,
				resolvedAt: null,
				frozen: false,
				replies: [],
			}
			emit('created', item)
			showInput.value = false
			content.value = ''
			mentionedUserIds.value = []
		} else {
			msgError((res as any).message || '批注保存失败，请重试')
		}
	} catch {
		msgError('批注保存失败，请重试')
	} finally {
		submitting.value = false
	}
}

// 点击其他地方隐藏浮层
function onDocClick(e: MouseEvent) {
	const target = e.target as HTMLElement
	if (target.closest('.annotation-floating') || target.closest('.annotation-input-panel')) return
	if (showFloating.value) showFloating.value = false
}

watch(() => props.containerRef, (el) => {
	if (el) {
		el.addEventListener('mouseup', onMouseUp)
		document.addEventListener('mousedown', onDocClick)
	}
}, { immediate: true })

onBeforeUnmount(() => {
	props.containerRef?.removeEventListener('mouseup', onMouseUp)
	document.removeEventListener('mousedown', onDocClick)
	if (hideTimer) clearTimeout(hideTimer)
})
</script>
