<template>
	<div v-if="visible" class="mention-popup" :style="popupStyle">
		<div v-if="loading" class="mention-popup__loading">搜索中...</div>
		<div v-else-if="users.length === 0" class="mention-popup__empty">无匹配用户</div>
		<div
v-for="(user, idx) in users" :key="user.id" class="mention-popup__item"
			:class="{ 'mention-popup__item--active': idx === activeIndex }" @mousedown.prevent="selectUser(user)">
			<el-avatar :size="20" :src="user.avatar || undefined">
				{{ user.name?.charAt(0) }}
			</el-avatar>
			<span class="mention-popup__name">{{ user.name }}</span>
		</div>
	</div>
</template>

<script setup lang="ts">
import { apiSearchMentionUsers } from '~/api/document-editor'
import type { MentionUser } from '~/api/document-editor'

const props = defineProps<{
	/** 绑定的 textarea DOM 元素 */
	textareaEl: HTMLTextAreaElement | null
}>()

const emit = defineEmits<{
	'select': [user: MentionUser, replaceStart: number, replaceEnd: number]
}>()

const visible = ref(false)
const loading = ref(false)
const users = ref<MentionUser[]>([])
const activeIndex = ref(0)
const popupStyle = ref<Record<string, string>>({})

// 记录 @ 触发的位置
let mentionStart = -1
let searchTimer: ReturnType<typeof setTimeout> | null = null

function handleInput() {
	const el = props.textareaEl
	if (!el) return

	const cursor = el.selectionStart
	const text = el.value
	// 向前查找最近的 @ 符号
	const before = text.slice(0, cursor)
	const atIdx = before.lastIndexOf('@')

	if (atIdx === -1 || (atIdx > 0 && /\S/.test(before[atIdx - 1]))) {
		// 没有 @ 或 @ 前面有非空白字符（不是独立触发）
		hide()
		return
	}

	const keyword = before.slice(atIdx + 1)
	// 如果关键词含空格或换行，说明已经结束 mention
	if (/[\s\n]/.test(keyword)) {
		hide()
		return
	}

	mentionStart = atIdx
	show(keyword)
}

function show(keyword: string) {
	visible.value = true
	activeIndex.value = 0
	positionPopup()

	if (searchTimer) clearTimeout(searchTimer)
	if (keyword.length === 0) {
		// 只输入了 @，不搜索
		users.value = []
		loading.value = false
		return
	}

	loading.value = true
	searchTimer = setTimeout(async () => {
		try {
			const res = await apiSearchMentionUsers(keyword)
			if (res.success) users.value = res.data
			else users.value = []
		} catch {
			users.value = []
		} finally {
			loading.value = false
		}
	}, 300)
}

function hide() {
	visible.value = false
	users.value = []
	mentionStart = -1
}

function selectUser(user: MentionUser) {
	const el = props.textareaEl
	if (!el) return

	const cursor = el.selectionStart
	emit('select', user, mentionStart, cursor)
	hide()
}

function handleKeydown(e: KeyboardEvent) {
	if (!visible.value || users.value.length === 0) return

	if (e.key === 'ArrowDown') {
		e.preventDefault()
		activeIndex.value = (activeIndex.value + 1) % users.value.length
	} else if (e.key === 'ArrowUp') {
		e.preventDefault()
		activeIndex.value = (activeIndex.value - 1 + users.value.length) % users.value.length
	} else if (e.key === 'Enter') {
		e.preventDefault()
		selectUser(users.value[activeIndex.value])
	} else if (e.key === 'Escape') {
		e.preventDefault()
		hide()
	}
}

function positionPopup() {
	const el = props.textareaEl
	if (!el) return
	const rect = el.getBoundingClientRect()
	// 简单定位：在 textarea 下方
	popupStyle.value = {
		position: 'fixed',
		left: `${rect.left}px`,
		top: `${rect.bottom + 4}px`,
		width: `${Math.min(rect.width, 240)}px`,
		zIndex: '10000',
	}
}

// 暴露方法给父组件绑定事件
defineExpose({ handleInput, handleKeydown, hide })
</script>
