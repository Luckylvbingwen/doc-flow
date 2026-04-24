<template>
	<Modal
v-model="visible" :title="dialogTitle" width="580px" destroy-on-close :confirm-loading="uploading"
		confirm-text="开始上传" @close="onClose" @confirm="handleUpload">
		<!-- 模式选择（首次 / 更新） — 文件详情页锁定更新模式时不显示 -->
		<div v-if="!lockedDocumentId" class="ufm-section">
			<label class="ufm-label">上传方式</label>
			<div class="ufm-mode-cards">
				<div class="ufm-mode-card" :class="{ active: mode === 'first' }" @click="mode = 'first'">
					<el-icon :size="22">
						<Document />
					</el-icon>
					<div>
						<div class="ufm-mode-title">首次上传</div>
						<div class="ufm-mode-desc">新文件，自动标记 v1.0</div>
					</div>
				</div>
				<div class="ufm-mode-card" :class="{ active: mode === 'update' }" @click="mode = 'update'">
					<el-icon :size="22">
						<RefreshRight />
					</el-icon>
					<div>
						<div class="ufm-mode-title">更新上传</div>
						<div class="ufm-mode-desc">已有文件，次版本号自动 +1</div>
					</div>
				</div>
			</div>
		</div>

		<!-- 更新模式：选目标文件 -->
		<div v-if="mode === 'update' && !lockedDocumentId" class="ufm-section">
			<label class="ufm-label">更新到的文件</label>
			<el-select
v-model="targetDocumentId" placeholder="选择已发布的文件" filterable style="width: 100%"
				:loading="targetLoading">
				<el-option
v-for="doc in publishedFiles" :key="doc.id" :label="`${doc.title} · ${doc.versionNo ?? '-'}`"
					:value="doc.id" />
			</el-select>
		</div>

		<!-- 文件拖拽 -->
		<div class="ufm-section">
			<label class="ufm-label">
				选择文件
				<span class="ufm-hint">（仅支持 Markdown .md，单文件 ≤ 50MB）</span>
			</label>
			<el-upload
ref="uploaderRef" drag :auto-upload="false" :multiple="false" :limit="1" accept=".md"
				:show-file-list="true" :on-change="onFileChange" :on-remove="onFileRemove" :on-exceed="onExceed">
				<el-icon :size="40" color="var(--df-primary)">
					<UploadFilled />
				</el-icon>
				<div class="ufm-drop-text">
					将文件拖到此处，或 <em>点击选择</em>
				</div>
				<template #tip>
					<div class="ufm-drop-tip">
						当前仅支持 Markdown（.md）。其他格式转换能力开发中。
					</div>
				</template>
			</el-upload>
		</div>

		<!-- 变更说明 -->
		<div class="ufm-section">
			<label class="ufm-label">
				变更说明
				<span class="ufm-hint">（可选，最多 500 字）</span>
			</label>
			<el-input
v-model="changeNote" type="textarea" :rows="3" maxlength="500" show-word-limit
				placeholder="简要描述本次上传的主要改动..." resize="none" />
		</div>
	</Modal>
</template>

<script setup lang="ts">
import { Document, RefreshRight, UploadFilled } from '@element-plus/icons-vue'
import type { UploadFile, UploadFiles, UploadInstance, UploadRawFile } from 'element-plus'
import { apiUploadDocument, apiUploadNewVersion, apiGetDocuments } from '~/api/documents'
import type { DocumentListItem, UploadResult } from '~/types/document'

const props = withDefaults(
	defineProps<{
		modelValue: boolean
		groupId: number
		mode?: 'first' | 'update'
		/** 锁定更新目标（从文件详情页"上传新版本"入口打开时传入） */
		lockedDocumentId?: number
	}>(),
	{
		mode: 'first',
		lockedDocumentId: undefined,
	},
)

const emit = defineEmits<{
	'update:modelValue': [value: boolean]
	success: [payload: UploadResult & { title: string }]
}>()

const visible = computed({
	get: () => props.modelValue,
	set: v => emit('update:modelValue', v),
})

const mode = ref<'first' | 'update'>(props.lockedDocumentId ? 'update' : props.mode)
const targetDocumentId = ref<number | null>(props.lockedDocumentId ?? null)
const changeNote = ref('')
const selectedFile = ref<File | null>(null)
const uploading = ref(false)

const publishedFiles = ref<DocumentListItem[]>([])
const targetLoading = ref(false)

const uploaderRef = ref<UploadInstance>()

const dialogTitle = computed(() => {
	if (props.lockedDocumentId) return '上传新版本'
	return mode.value === 'first' ? '上传文件' : '更新版本'
})

watch(() => props.modelValue, (v) => {
	if (!v) return
	// 打开时初始化
	mode.value = props.lockedDocumentId ? 'update' : props.mode
	targetDocumentId.value = props.lockedDocumentId ?? null
	changeNote.value = ''
	selectedFile.value = null
	uploaderRef.value?.clearFiles()
	// 更新模式且未锁定 → 拉已发布列表
	if (mode.value === 'update' && !props.lockedDocumentId) {
		loadPublishedFiles()
	}
})

watch(mode, (v) => {
	if (v === 'update' && !props.lockedDocumentId && publishedFiles.value.length === 0) {
		loadPublishedFiles()
	}
})

async function loadPublishedFiles() {
	if (!props.groupId) return
	targetLoading.value = true
	try {
		const res = await apiGetDocuments({ groupId: props.groupId, status: 4, page: 1, pageSize: 100 })
		if (res.success) {
			publishedFiles.value = res.data.list
		}
	} finally {
		targetLoading.value = false
	}
}

function onFileChange(file: UploadFile, _fileList: UploadFiles) {
	const raw = file.raw as UploadRawFile | undefined
	if (!raw) return
	if (!/\.md$/i.test(raw.name)) {
		msgError('仅支持 Markdown（.md）文件')
		uploaderRef.value?.clearFiles()
		selectedFile.value = null
		return
	}
	if (raw.size > 50 * 1024 * 1024) {
		msgError('文件超过 50MB 限制')
		uploaderRef.value?.clearFiles()
		selectedFile.value = null
		return
	}
	selectedFile.value = raw
}

function onFileRemove() {
	selectedFile.value = null
}

function onExceed() {
	msgWarning('一次只能上传一个文件')
}

async function handleUpload() {
	if (!selectedFile.value) {
		msgWarning('请先选择文件')
		return
	}
	if (mode.value === 'update' && !targetDocumentId.value) {
		msgWarning('请选择要更新的文件')
		return
	}

	const formData = new FormData()
	formData.append('file', selectedFile.value)
	if (changeNote.value.trim()) {
		formData.append('changeNote', changeNote.value.trim())
	}

	uploading.value = true
	try {
		let res
		let title = ''
		if (mode.value === 'first') {
			formData.append('groupId', String(props.groupId))
			res = await apiUploadDocument(formData)
			title = selectedFile.value.name.replace(/\.[^.]+$/, '')
		} else {
			const doc = publishedFiles.value.find(d => d.id === targetDocumentId.value)
				|| { title: '' }
			title = doc.title
			res = await apiUploadNewVersion(targetDocumentId.value!, formData)
		}
		if (res.success) {
			msgSuccess(res.message || '上传成功')
			emit('success', { ...res.data, title })
			visible.value = false
		} else {
			msgError(res.message || '上传失败')
		}
	} catch {
		msgError('上传失败')
	} finally {
		uploading.value = false
	}
}

function onClose() {
	uploaderRef.value?.clearFiles()
	selectedFile.value = null
	changeNote.value = ''
}
</script>

<style lang="scss" scoped>
.ufm-section {
	margin-bottom: 18px;

	&:last-child {
		margin-bottom: 0;
	}
}

.ufm-label {
	display: block;
	margin-bottom: 8px;
	font-size: 13px;
	font-weight: 500;
	color: var(--df-text);
}

.ufm-hint {
	margin-left: 6px;
	font-size: 12px;
	font-weight: 400;
	color: var(--df-subtext);
}

.ufm-mode-cards {
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: 10px;
}

.ufm-mode-card {
	display: flex;
	gap: 10px;
	padding: 12px 14px;
	background: var(--df-surface);
	border: 1px solid var(--df-border);
	border-radius: 8px;
	cursor: pointer;
	transition: border-color 0.2s, background 0.2s;

	&:hover {
		border-color: var(--df-primary);
	}

	&.active {
		border-color: var(--df-primary);
		background: var(--df-primary-soft);
	}

	.el-icon {
		color: var(--df-primary);
	}
}

.ufm-mode-title {
	font-size: 13px;
	font-weight: 500;
	color: var(--df-text);
}

.ufm-mode-desc {
	font-size: 12px;
	color: var(--df-subtext);
	margin-top: 2px;
}

.ufm-drop-text {
	margin-top: 8px;
	font-size: 13px;
	color: var(--df-subtext);

	em {
		color: var(--df-primary);
		font-style: normal;
		font-weight: 500;
	}
}

.ufm-drop-tip {
	font-size: 12px;
	color: var(--df-subtext);
	margin-top: 4px;
}
</style>
