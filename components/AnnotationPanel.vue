<template>
	<div class="annotation-panel">
		<div class="annotation-panel__header">
			<span class="annotation-panel__title">文本批注 ({{ annotations.length }})</span>
			<span style="margin-left: auto" />
			<el-button v-if="!allFrozen" size="small" type="primary" link @click="$emit('request-add')">
				+ 新增
			</el-button>
			<el-button text size="small" @click="$emit('close')">
				<el-icon :size="14">
					<Close />
				</el-icon>
			</el-button>
		</div>

		<!-- 冻结提示 -->
		<div v-if="allFrozen" class="annotation-panel__frozen-banner">
			⚠ 该版本批注已冻结，不可编辑
		</div>

		<!-- 筛选 TAB -->
		<div class="annotation-panel__tabs">
			<button
v-for="tab in tabs" :key="tab.key" class="annotation-panel__tab"
				:class="{ active: activeTab === tab.key }" @click="activeTab = tab.key">
				{{ tab.label }} ({{ tab.count }})
			</button>
		</div>

		<!-- 批注列表 -->
		<el-scrollbar class="annotation-panel__list">
			<div v-if="!loading && filteredAnnotations.length === 0" class="annotation-panel__empty">
				暂无批注
			</div>
			<div
v-for="item in filteredAnnotations" :key="item.id" :ref="el => setItemRef(item.id, el as HTMLElement)"
				class="annotation-item"
				:class="{ 'annotation-item--frozen': item.frozen, 'annotation-item--active': activeAnnotationId === item.id }"
				@click="$emit('locate', item)">
				<!-- 卡片主体 -->
				<div class="annotation-item__header">
					<el-avatar :size="24" :src="item.authorAvatar || undefined">
						{{ item.authorName?.charAt(0) }}
					</el-avatar>
					<span class="annotation-item__author">{{ item.authorName }}</span>
					<span class="annotation-item__time">{{ formatTime(item.createdAt) }}</span>
					<span v-if="item.frozen" class="annotation-item__frozen-tag">已冻结</span>
					<span v-if="item.status === 2" class="annotation-item__resolved-tag">已解决</span>
				</div>
				<div v-if="item.quoteText" class="annotation-item__quote">"{{ item.quoteText }}"</div>
				<div class="annotation-item__content">{{ item.content }}</div>

				<!-- 回复列表 -->
				<div v-if="item.replies.length > 0" class="annotation-item__replies">
					<div v-for="rp in item.replies" :key="rp.id" class="annotation-reply">
						<el-avatar :size="20" :src="rp.authorAvatar || undefined">
							{{ rp.authorName?.charAt(0) }}
						</el-avatar>
						<div class="annotation-reply__body">
							<span class="annotation-reply__author">{{ rp.authorName }}</span>
							<span class="annotation-reply__content">{{ rp.content }}</span>
							<span class="annotation-reply__time">{{ formatTime(rp.createdAt) }}</span>
						</div>
					</div>
				</div>

				<!-- 操作 -->
				<div v-if="!item.frozen && item.status === 1" class="annotation-item__actions">
					<el-button size="small" link @click.stop="startReply(item.id)">回复</el-button>
					<el-button size="small" link @click.stop="handleResolve(item.id)">标记解决</el-button>
					<el-button size="small" link type="danger" @click.stop="handleDelete(item.id)">删除</el-button>
				</div>

				<!-- 回复输入框 -->
				<div v-if="replyingId === item.id" class="annotation-item__reply-input" @click.stop>
					<el-input
ref="replyInputRef" v-model="replyContent" type="textarea" :rows="2" placeholder="回复...（@ 可提及用户）"
						maxlength="1000" @input="onReplyInput" @keydown="onReplyKeydown" />
					<MentionPopup ref="replyMentionRef" :textarea-el="replyTextareaEl" @select="onReplyMentionSelect" />
					<div class="annotation-item__reply-actions">
						<el-button size="small" @click="cancelReply">取消</el-button>
						<el-button size="small" type="primary" :loading="replySubmitting" @click="submitReply(item.id)">
							发送
						</el-button>
					</div>
				</div>
			</div>
		</el-scrollbar>
		<div class="annotation-panel__footer">
			在预览区域选中文字即可添加批注
		</div>
	</div>
</template>

<script setup lang="ts">
import { Close } from '@element-plus/icons-vue'
import { apiGetAnnotations, apiUpdateAnnotation, apiDeleteAnnotation, apiCreateAnnotationReply } from '~/api/document-editor'
import type { MentionUser } from '~/api/document-editor'
import { formatTime } from '~/utils/format'
import type { AnnotationItem, AnnotationReply } from '~/types/document-editor'

const props = defineProps<{
	docId: number
	activeAnnotationId?: string
}>()

const emit = defineEmits<{
	'request-add': []
	'locate': [item: AnnotationItem]
	'close': []
	'changed': []
}>()

const annotations = ref<AnnotationItem[]>([])
const loading = ref(true)
const activeTab = ref<'all' | 'open' | 'resolved'>('all')

const allFrozen = computed(() => annotations.value.length > 0 && annotations.value.every(a => a.frozen))
const openCount = computed(() => annotations.value.filter(a => a.status === 1).length)
const resolvedCount = computed(() => annotations.value.filter(a => a.status === 2).length)

const tabs = computed(() => [
	{ key: 'all' as const, label: '全部', count: annotations.value.length },
	{ key: 'open' as const, label: '未解决', count: openCount.value },
	{ key: 'resolved' as const, label: '已解决', count: resolvedCount.value },
])

const filteredAnnotations = computed(() => {
	if (activeTab.value === 'open') return annotations.value.filter(a => a.status === 1)
	if (activeTab.value === 'resolved') return annotations.value.filter(a => a.status === 2)
	return annotations.value
})

// 回复状态
const replyingId = ref('')
const replyContent = ref('')
const replySubmitting = ref(false)
const replyInputRef = ref<{ textarea?: HTMLTextAreaElement } | null>(null)
const replyMentionRef = ref<{ handleInput: () => void; handleKeydown: (e: KeyboardEvent) => void; hide: () => void } | null>(null)
const replyMentionedUserIds = ref<number[]>([])
const replyTextareaEl = computed(() => replyInputRef.value?.textarea ?? null)

// DOM 引用，用于面板滚动定位
const itemRefs = new Map<string, HTMLElement>()
function setItemRef(id: string, el: HTMLElement | null) {
	if (el) itemRefs.set(id, el)
	else itemRefs.delete(id)
}

onMounted(load)

async function load() {
	loading.value = true
	const res = await apiGetAnnotations(props.docId)
	if (res.success) annotations.value = res.data
	loading.value = false
}

function startReply(id: string) {
	replyingId.value = id
	replyContent.value = ''
	replyMentionedUserIds.value = []
}

function cancelReply() {
	replyingId.value = ''
	replyMentionedUserIds.value = []
	replyMentionRef.value?.hide()
}

function onReplyInput() {
	replyMentionRef.value?.handleInput()
}

function onReplyKeydown(e: KeyboardEvent | Event) {
	replyMentionRef.value?.handleKeydown(e as KeyboardEvent)
}

function onReplyMentionSelect(user: MentionUser, replaceStart: number, replaceEnd: number) {
	const before = replyContent.value.slice(0, replaceStart)
	const after = replyContent.value.slice(replaceEnd)
	replyContent.value = `${before}@${user.name} ${after}`
	if (!replyMentionedUserIds.value.includes(user.id)) {
		replyMentionedUserIds.value.push(user.id)
	}
	nextTick(() => {
		const pos = replaceStart + user.name.length + 2
		const el = replyTextareaEl.value
		if (el) {
			el.selectionStart = pos
			el.selectionEnd = pos
			el.focus()
		}
	})
}

async function submitReply(annotationId: string) {
	if (!replyContent.value.trim()) return
	replySubmitting.value = true
	try {
		const res = await apiCreateAnnotationReply(props.docId, annotationId, {
			content: replyContent.value,
			mentionedUserIds: replyMentionedUserIds.value.length > 0 ? replyMentionedUserIds.value : undefined,
		})
		if (res.success && res.data) {
			const ann = annotations.value.find(a => a.id === annotationId)
			if (ann) ann.replies.push(res.data)
		} else {
			msgError(res.message || '回复发送失败')
		}
	} catch {
		msgError('回复发送失败')
	} finally {
		replyingId.value = ''
		replyContent.value = ''
		replyMentionedUserIds.value = []
		replySubmitting.value = false
	}
}

async function handleResolve(id: string) {
	const res = await apiUpdateAnnotation(props.docId, id, { status: 2 })
	if (res.success) {
		const ann = annotations.value.find(a => a.id === id)
		if (ann) ann.status = 2
	} else {
		msgError(res.message || '标记解决失败')
	}
}

async function handleDelete(id: string) {
	const confirmed = await msgConfirm('确定要删除该批注吗？删除后不可恢复。', '删除批注')
	if (!confirmed) return
	await apiDeleteAnnotation(props.docId, id)
	annotations.value = annotations.value.filter(a => a.id !== id)
	emit('changed')
}

/** 供父组件调用：添加新批注后刷新列表 */
function addAnnotation(item: AnnotationItem) {
	annotations.value.unshift(item)
}

/** 供父组件调用：新增或覆盖批注（实时同步） */
function upsertAnnotation(item: AnnotationItem) {
	const idx = annotations.value.findIndex(a => a.id === item.id)
	if (idx === -1) {
		annotations.value.unshift(item)
		return
	}
	annotations.value[idx] = item
}

/** 供父组件调用：删除批注（实时同步） */
function removeAnnotation(annotationId: string) {
	annotations.value = annotations.value.filter(a => a.id !== annotationId)
}

/** 供父组件调用：追加回复（实时同步） */
function addReply(annotationId: string, reply: AnnotationReply) {
	const ann = annotations.value.find(a => a.id === annotationId)
	if (!ann) return
	if (ann.replies.some(r => r.id === reply.id)) return
	ann.replies.push(reply)
}

/** 供父组件调用：滚动到指定批注 */
function scrollTo(annotationId: string) {
	const el = itemRefs.get(annotationId)
	if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

defineExpose({ refresh: load, scrollTo, addAnnotation, upsertAnnotation, removeAnnotation, addReply })
</script>
