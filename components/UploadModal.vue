<template>
	<Modal v-model="visible" title="上传文件" width="580px" destroy-on-close @close="onClose">
		<template #default>
			<!-- 上传到 -->
			<div class="upload-modal-target">
				上传到：<strong>{{ repoName || '未选择' }}</strong>
			</div>

			<!-- 上传类型选择 -->
			<div class="upload-modal-label">请选择上传类型：</div>
			<div class="upload-mode-cards">
				<div class="upload-mode-card" :class="{ active: uploadMode === 'new' }" @click="selectMode('new')">
					<el-icon :size="22" class="upload-mode-icon">
						<Document />
					</el-icon>
					<div>
						<div class="upload-mode-title">首次上传</div>
						<div class="upload-mode-desc">上传新文件，自动标记 v1.0</div>
					</div>
				</div>
				<div class="upload-mode-card" :class="{ active: uploadMode === 'update' }" @click="selectMode('update')">
					<el-icon :size="22" class="upload-mode-icon">
						<RefreshRight />
					</el-icon>
					<div>
						<div class="upload-mode-title">更新上传</div>
						<div class="upload-mode-desc">选择已有文件，版本号自动递增</div>
					</div>
				</div>
			</div>

			<!-- 首次上传内容 -->
			<div v-if="uploadMode === 'new'" class="upload-step-content">
				<el-alert type="success" :closable="false" show-icon class="upload-tip">
					首次上传的文件将自动标记为 <strong>v1.0</strong>，文件名格式：原文件名_v1.0.扩展名
				</el-alert>
				<FileUploader ref="newUploaderRef" version-tag="v1.0" @change="onFileChange" />
			</div>

			<!-- 更新上传内容 -->
			<div v-if="uploadMode === 'update'" class="upload-step-content">
				<div class="upload-modal-label">第 1 步：选择要更新的文件</div>
				<el-scrollbar max-height="200px" class="upload-target-list">
					<template v-if="publishedFiles.length > 0">
						<div
v-for="file in publishedFiles" :key="file.id" class="upload-target-item"
							:class="{ active: selectedTargetId === file.id }" @click="selectTarget(file)">
							<div class="df-upload-file-icon" :class="getFileTypeClass(file.name)">
								{{ getFileTypeLabel(file.name) }}
							</div>
							<div class="upload-target-info">
								<div class="upload-target-name">{{ file.name }}</div>
								<div class="upload-target-meta">
									当前版本：{{ file.version }} | 上传者：{{ file.uploader }}
								</div>
							</div>
							<el-icon v-if="selectedTargetId === file.id" class="upload-target-check">
								<Check />
							</el-icon>
						</div>
					</template>
					<div v-else class="upload-target-empty">该组下暂无已发布文件</div>
				</el-scrollbar>

				<!-- 第2步：上传新版本 -->
				<div v-if="selectedTarget" class="upload-update-step2">
					<div class="upload-modal-label">第 2 步：上传新版本文件</div>
					<el-alert type="info" :closable="false" show-icon class="upload-tip">
						更新「<strong>{{ selectedTarget.name }}</strong>」，版本号将从
						<strong>{{ selectedTarget.version }} → {{ nextVersion }}</strong>
						自动递增，文件名以首次上传文件名为准。
						仅允许上传 <strong>{{ targetExtLabel }}</strong> 格式文件。
					</el-alert>
					<FileUploader
ref="updateUploaderRef" :multiple="false" :accept="targetAccept"
						:version-tag="nextVersion" @change="onFileChange" />
				</div>
			</div>
		</template>

		<template #footer>
			<el-button @click="visible = false">取消</el-button>
			<el-button type="primary" :disabled="!canSubmit" :loading="uploading" @click="handleSubmit">
				<el-icon class="el-icon--left">
					<Upload />
				</el-icon>
				开始上传
			</el-button>
		</template>
	</Modal>
</template>

<script setup>
import { Document, RefreshRight, Check, Upload } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

const props = defineProps({
	modelValue: { type: Boolean, default: false },
	repoName: { type: String, default: '' },
	publishedFiles: { type: Array, default: () => [] }
})

const emit = defineEmits(['update:modelValue', 'submit', 'close'])

const visible = computed({
	get: () => props.modelValue,
	set: (val) => emit('update:modelValue', val)
})

const uploadMode = ref('')
const selectedTargetId = ref(null)
const selectedTarget = ref(null)
const hasValidFiles = ref(false)
const uploading = ref(false)

const newUploaderRef = ref(null)
const updateUploaderRef = ref(null)

const nextVersion = computed(() => {
	if (!selectedTarget.value) return ''
	const vStr = selectedTarget.value.version || 'v0.0'
	const vNum = parseFloat(vStr.replace('v', ''))
	return 'v' + (vNum + 1).toFixed(1)
})

const targetExt = computed(() => {
	if (!selectedTarget.value) return ''
	const name = selectedTarget.value.name
	const dot = name.lastIndexOf('.')
	return dot === -1 ? '' : name.substring(dot).toLowerCase()
})

const targetAccept = computed(() => {
	if (!targetExt.value) return ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.md', '.txt']
	return [targetExt.value]
})

const targetExtLabel = computed(() => {
	return targetExt.value ? targetExt.value.replace('.', '').toUpperCase() : ''
})

const canSubmit = computed(() => {
	if (!uploadMode.value) return false
	if (!hasValidFiles.value) return false
	if (uploadMode.value === 'update' && !selectedTarget.value) return false
	return true
})

function selectMode(mode) {
	uploadMode.value = mode
	selectedTargetId.value = null
	selectedTarget.value = null
	hasValidFiles.value = false
}

function selectTarget(file) {
	selectedTargetId.value = file.id
	selectedTarget.value = file
	hasValidFiles.value = false
}

function onFileChange({ validFiles }) {
	hasValidFiles.value = validFiles.length > 0
}

function getActiveUploader() {
	if (uploadMode.value === 'new') return newUploaderRef.value
	if (uploadMode.value === 'update') return updateUploaderRef.value
	return null
}

function handleSubmit() {
	const uploader = getActiveUploader()
	if (!uploader) return

	const validFiles = uploader.getValidFiles()
	if (validFiles.length === 0) return

	uploading.value = true

	// 模拟上传进度
	let completed = 0
	validFiles.forEach((file, i) => {
		uploader.updateFileStatus(file.uid, 'uploading', 0)
		let progress = 0
		const timer = setInterval(() => {
			progress += Math.random() * 30 + 10
			if (progress >= 100) {
				progress = 100
				uploader.updateFileStatus(file.uid, 'success', 100)
				clearInterval(timer)
				completed++
				if (completed === validFiles.length) {
					setTimeout(() => {
						uploading.value = false
						const msg = uploadMode.value === 'update'
							? '新版本上传成功！已进入审批流程'
							: '文件上传成功！已自动标记 v1.0，已进入审批流程'
						ElMessage.success(msg)
						emit('submit', {
							mode: uploadMode.value,
							files: validFiles.map(f => f.raw),
							targetFile: selectedTarget.value
						})
						visible.value = false
					}, 500)
				}
			} else {
				uploader.updateFileStatus(file.uid, 'uploading', Math.round(progress))
			}
		}, 300 + i * 100)
	})
}

function onClose() {
	uploadMode.value = ''
	selectedTargetId.value = null
	selectedTarget.value = null
	hasValidFiles.value = false
	uploading.value = false
	emit('close')
}

function getFileTypeLabel(name) {
	const ext = name.split('.').pop().toLowerCase()
	const map = { pdf: 'PDF', doc: 'DOC', docx: 'DOCX', xls: 'XLS', xlsx: 'XLSX', md: 'MD', txt: 'TXT' }
	return map[ext] || ext.toUpperCase()
}

function getFileTypeClass(name) {
	const ext = name.split('.').pop().toLowerCase()
	if (ext === 'pdf') return 'is-pdf'
	if (['doc', 'docx'].includes(ext)) return 'is-word'
	if (['xls', 'xlsx'].includes(ext)) return 'is-excel'
	if (ext === 'md') return 'is-md'
	return 'is-other'
}
</script>
