<template>
	<section class="pf-page-stack">
		<PageTitle title="上传组件预览" subtitle="完整上传弹窗流程验证">
			<template #actions>
				<el-button type="primary" @click="uploadVisible = true">
					<el-icon class="el-icon--left">
						<Upload />
					</el-icon>
					上传文件
				</el-button>
			</template>
		</PageTitle>

		<!-- 文件列表（模拟组内已发布文件） -->
		<DataTable :data="mockFiles" :columns="fileColumns" :action-width="80">
			<template #name="{ row }">
				<div style="display: flex; align-items: center; gap: 8px;">
					<div class="df-upload-file-icon" :class="getFileTypeClass(row.name)"
						style="width: 28px; height: 28px; font-size: 9px;">
						{{ getFileTypeLabel(row.name) }}
					</div>
					<span>{{ row.name }}</span>
				</div>
			</template>
			<template #action="{ row }">
				<el-button link type="primary" size="small" @click="onDownload(row)">下载</el-button>
			</template>
		</DataTable>

		<!-- 上传弹窗 -->
		<UploadModal v-model="uploadVisible" repo-name="产品需求组" :published-files="mockFiles" @submit="onUploadSubmit" />
	</section>
</template>

<script setup>
import { Upload } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

definePageMeta({
	layout: 'prototype'
})

const uploadVisible = ref(false)

const mockFiles = ref([
	{ id: 101, name: 'DocFlow-产品需求文档-v3.md', version: 'v3.2', status: 'published', uploader: '李婷婷', date: '2026-03-10', size: '245 KB' },
	{ id: 102, name: '2026年Q1产品路线图.pdf', version: 'v2.0', status: 'published', uploader: '张晓明', date: '2026-03-08', size: '1.8 MB' },
	{ id: 103, name: '竞品分析-协同办公平台.docx', version: 'v1.5', status: 'published', uploader: '王建国', date: '2026-03-11', size: '3.2 MB' },
	{ id: 104, name: '数据看板设计稿说明.pdf', version: 'v1.3', status: 'published', uploader: '张晓明', date: '2026-03-05', size: '5.6 MB' },
	{ id: 105, name: 'API接口规范文档.md', version: 'v4.1', status: 'published', uploader: '陈思远', date: '2026-03-09', size: '310 KB' },
])

const fileColumns = [
	{ prop: 'name', label: '文件名', minWidth: 280, slot: 'name' },
	{ prop: 'version', label: '版本', width: 80 },
	{ prop: 'uploader', label: '上传者', width: 100 },
	{ prop: 'date', label: '上传日期', width: 120 },
	{ prop: 'size', label: '大小', width: 100 },
]

function onUploadSubmit({ mode, files, targetFile }) {
	if (mode === 'new') {
		ElMessage.success('首次上传 ' + files.length + ' 个文件成功')
	} else {
		ElMessage.success('更新「' + targetFile.name + '」成功')
	}
}

function onDownload(row) {
	ElMessage.info('下载：' + row.name + '（模拟）')
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
