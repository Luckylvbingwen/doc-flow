<template>
	<div class="df-file-uploader">
		<!-- ── 拖拽区域 ── -->
		<div
class="df-upload-dropzone" :class="{ 'is-dragover': isDragover, 'is-disabled': disabled }"
			@dragover.prevent="onDragover" @dragleave.prevent="onDragleave" @drop.prevent="onDrop" @click="triggerFileInput">
			<el-icon class="df-upload-icon" :size="40">
				<UploadFilled />
			</el-icon>
			<div class="df-upload-text">
				<p class="df-upload-main-text">拖拽文件到此处</p>
				<p class="df-upload-sub-text">
					或点击选择文件<template v-if="multiple">（支持批量）</template>
				</p>
			</div>
			<el-button type="primary" size="small" :disabled="disabled" @click.stop="triggerFileInput">
				<el-icon class="el-icon--left">
					<FolderOpened />
				</el-icon>
				选择文件
			</el-button>
			<input
ref="fileInputRef" type="file" :multiple="multiple" :accept="acceptString" class="df-upload-input"
				@change="onFileInputChange">
		</div>

		<!-- ── 格式提示 ── -->
		<div class="df-upload-tip">
			<span>支持格式：{{ acceptLabel }}</span>
			<span class="df-upload-tip-sep">|</span>
			<span>单文件上限：{{ formatSize(maxSize) }}</span>
		</div>

		<!-- ── 待上传文件列表 ── -->
		<div v-if="fileList.length > 0" class="df-upload-file-list">
			<div class="df-upload-file-list-title">
				待上传文件（{{ fileList.length }}）
			</div>
			<el-scrollbar max-height="240px">
				<div
v-for="(file, index) in fileList" :key="file.uid" class="df-upload-file-item"
					:class="{ 'is-error': file.error }">
					<!-- 文件图标 -->
					<div class="df-upload-file-icon" :class="getFileTypeClass(file.raw.name)">
						{{ getFileTypeLabel(file.raw.name) }}
					</div>
					<!-- 文件信息 -->
					<div class="df-upload-file-info">
						<div class="df-upload-file-name">
							<el-tooltip
v-if="!file.error && versionTag" :content="getVersionedName(file.raw.name)"
								placement="top" :show-after="300">
								<span class="df-upload-file-name-text">{{ file.raw.name }}</span>
							</el-tooltip>
							<span v-else class="df-upload-file-name-text">{{ file.raw.name }}</span>
							<span v-if="!file.error && versionTag" class="df-upload-version-tag">
								{{ versionTag }}
							</span>
						</div>
						<div class="df-upload-file-meta">
							{{ formatSize(file.raw.size) }}
						</div>
						<!-- 进度条 -->
						<el-progress
v-if="file.status === 'uploading'" :percentage="file.progress" :stroke-width="3"
							:show-text="false" class="df-upload-progress" />
					</div>
					<!-- 状态标识 -->
					<div class="df-upload-file-status">
						<el-tag v-if="file.error" type="danger" size="small" disable-transitions>
							{{ file.error }}
						</el-tag>
						<el-tag v-else-if="file.status === 'success'" type="success" size="small" disable-transitions>
							已完成
						</el-tag>
						<el-tag v-else-if="file.status === 'uploading'" type="warning" size="small" disable-transitions>
							上传中
						</el-tag>
						<el-tag v-else type="info" size="small" disable-transitions>
							就绪
						</el-tag>
					</div>
					<!-- 移除按钮 -->
					<el-button
v-if="file.status !== 'uploading' && file.status !== 'success'" type="danger" text size="small"
						class="df-upload-file-remove" @click="removeFile(index)">
						<el-icon>
							<Close />
						</el-icon>
					</el-button>
				</div>
			</el-scrollbar>
		</div>
	</div>
</template>

<script setup>
import { UploadFilled, FolderOpened, Close } from '@element-plus/icons-vue'

const props = defineProps({
	/** 是否支持多选 */
	multiple: { type: Boolean, default: true },
	/** 允许的文件扩展名列表，如 ['.pdf', '.docx', '.md'] */
	accept: {
		type: Array,
		default: () => ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.md', '.txt']
	},
	/** 单文件大小上限（字节），默认 50MB */
	maxSize: { type: Number, default: 50 * 1024 * 1024 },
	/** 文件名正则校验（可选） */
	namePattern: { type: RegExp, default: null },
	/** 文件名正则不匹配时的错误提示 */
	namePatternMessage: { type: String, default: '文件名格式不符合规范' },
	/** 版本标签，如 'v1.0'，为空则不显示版本化名称 */
	versionTag: { type: String, default: '' },
	/** 是否禁用 */
	disabled: { type: Boolean, default: false },
	/** 自定义格式展示名（不传则自动从 accept 生成） */
	acceptLabel: { type: String, default: '' }
})

const emit = defineEmits(['change', 'remove'])

/* ── 内部状态 ── */
const fileInputRef = ref(null)
const isDragover = ref(false)
const fileList = ref([])

let uidCounter = 0
const genUid = () => `upload-${Date.now()}-${++uidCounter}`

/* ── 计算属性 ── */
const acceptString = computed(() => props.accept.join(','))

const acceptLabel = computed(() => {
	if (props.acceptLabel) return props.acceptLabel
	return props.accept
		.map(ext => ext.replace('.', '').toUpperCase())
		.join('、')
})

/* ── 方法 ── */
function triggerFileInput() {
	if (props.disabled) return
	fileInputRef.value?.click()
}

function onDragover() {
	if (props.disabled) return
	isDragover.value = true
}

function onDragleave() {
	isDragover.value = false
}

function onDrop(e) {
	isDragover.value = false
	if (props.disabled) return
	const files = e.dataTransfer?.files
	if (files) addFiles(files)
}

function onFileInputChange(e) {
	const files = e.target.files
	if (files) addFiles(files)
	// 重置 input 以允许再次选择同名文件
	e.target.value = ''
}

function addFiles(nativeFiles) {
	const incoming = Array.from(nativeFiles)
	// 非多选模式只取第一个
	const toAdd = props.multiple ? incoming : [incoming[0]]

	if (!props.multiple) {
		// 单文件模式：替换现有列表
		fileList.value = []
	}

	for (const raw of toAdd) {
		const item = {
			uid: genUid(),
			raw,
			status: 'ready', // ready | uploading | success | error
			progress: 0,
			error: validateFile(raw)
		}
		fileList.value.push(item)
	}
	emitChange()
}

function validateFile(file) {
	// 扩展名校验
	const ext = '.' + file.name.split('.').pop().toLowerCase()
	if (!props.accept.some(a => ext === a.toLowerCase())) {
		return '格式不支持'
	}
	// 大小校验
	if (file.size > props.maxSize) {
		return `超过${formatSize(props.maxSize)}`
	}
	// 命名规范校验
	if (props.namePattern && !props.namePattern.test(file.name)) {
		return props.namePatternMessage
	}
	return ''
}

function removeFile(index) {
	const removed = fileList.value.splice(index, 1)
	emit('remove', removed[0])
	emitChange()
}

function emitChange() {
	emit('change', {
		files: fileList.value,
		validFiles: fileList.value.filter(f => !f.error),
		hasError: fileList.value.some(f => !!f.error)
	})
}

/* ── 工具函数 ── */
function formatSize(bytes) {
	if (bytes >= 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB'
	if (bytes >= 1024) return (bytes / 1024).toFixed(0) + ' KB'
	return bytes + ' B'
}

function getFileTypeLabel(name) {
	const ext = name.split('.').pop().toLowerCase()
	const map = {
		pdf: 'PDF', doc: 'DOC', docx: 'DOCX',
		xls: 'XLS', xlsx: 'XLSX', md: 'MD', txt: 'TXT'
	}
	return map[ext] || ext.toUpperCase()
}

function getFileTypeClass(name) {
	const ext = name.split('.').pop().toLowerCase()
	if (['pdf'].includes(ext)) return 'is-pdf'
	if (['doc', 'docx'].includes(ext)) return 'is-word'
	if (['xls', 'xlsx'].includes(ext)) return 'is-excel'
	if (['md'].includes(ext)) return 'is-md'
	return 'is-other'
}

function getVersionedName(name) {
	if (!props.versionTag) return name
	const dotIndex = name.lastIndexOf('.')
	if (dotIndex === -1) return `${name}_${props.versionTag}`
	const base = name.substring(0, dotIndex)
	const ext = name.substring(dotIndex)
	return `${base}_${props.versionTag}${ext}`
}

/* ── 暴露给父组件 ── */
function getValidFiles() {
	return fileList.value.filter(f => !f.error)
}

function getRawFiles() {
	return getValidFiles().map(f => f.raw)
}

function clearFiles() {
	fileList.value = []
	emitChange()
}

function updateFileStatus(uid, status, progress = 0) {
	const file = fileList.value.find(f => f.uid === uid)
	if (file) {
		file.status = status
		file.progress = progress
	}
}

defineExpose({
	getValidFiles,
	getRawFiles,
	clearFiles,
	updateFileStatus,
	fileList
})
</script>
