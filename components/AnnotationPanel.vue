<template>
	<div class="annotation-panel">
		<div class="annotation-panel__header">
			<span class="annotation-panel__title">批注 ({{ openCount }})</span>
			<el-button size="small" type="primary" link @click="showAddForm = true">+ 新增</el-button>
		</div>

		<!-- 新增输入区 -->
		<div v-if="showAddForm" class="annotation-panel__add">
			<el-input v-model="newContent" type="textarea" :rows="3" placeholder="输入批注内容..." />
			<div class="annotation-panel__add-actions">
				<el-button size="small" @click="showAddForm = false">取消</el-button>
				<el-button size="small" type="primary" :loading="submitting" @click="handleAdd">提交</el-button>
			</div>
		</div>

		<!-- 批注列表 -->
		<el-scrollbar>
			<div v-if="!loading && annotations.length === 0" class="annotation-panel__empty">暂无批注</div>
			<div v-for="item in annotations" :key="item.id" class="annotation-item">
				<div v-if="item.quoteText" class="annotation-item__quote">{{ item.quoteText }}</div>
				<div class="annotation-item__content">{{ item.content }}</div>
				<div class="annotation-item__meta">
					<span>{{ item.authorName }}</span>
					<span>{{ formatTime(item.createdAt) }}</span>
				</div>
				<div class="annotation-item__actions">
					<el-button size="small" link @click="handleResolve(item.id)">标记解决</el-button>
					<el-button size="small" link type="danger" @click="handleDelete(item.id)">删除</el-button>
				</div>
			</div>
		</el-scrollbar>
	</div>
</template>

<script setup lang="ts">
import { apiGetAnnotations, apiCreateAnnotation, apiUpdateAnnotation, apiDeleteAnnotation } from '~/api/document-editor'
import { formatTime } from '~/utils/format'
import type { AnnotationItem } from '~/types/document-editor'

const props = defineProps<{ docId: number }>()

const annotations = ref<AnnotationItem[]>([])
const loading = ref(true)
const showAddForm = ref(false)
const newContent = ref('')
const submitting = ref(false)
const openCount = computed(() => annotations.value.filter(a => a.status === 1).length)

onMounted(load)

async function load() {
	loading.value = true
	const res = await apiGetAnnotations(props.docId)
	if (res.success) annotations.value = res.data
	loading.value = false
}

async function handleAdd() {
	if (!newContent.value.trim()) return
	submitting.value = true
	await apiCreateAnnotation(props.docId, { content: newContent.value, quoteText: '' })
	newContent.value = ''
	showAddForm.value = false
	submitting.value = false
	await load()
}

async function handleResolve(id: string) {
	await apiUpdateAnnotation(props.docId, id, { status: 2 })
	annotations.value = annotations.value.filter(a => a.id !== id)
}

async function handleDelete(id: string) {
	await apiDeleteAnnotation(props.docId, id)
	annotations.value = annotations.value.filter(a => a.id !== id)
}
</script>
