<template>
	<div class="doc-preview" :class="`doc-preview--${fileType}`">
		<!-- 加载态 -->
		<div v-if="loading" class="doc-preview__loading">
			<el-icon class="is-loading" :size="28" color="var(--df-primary)">
				<Loading />
			</el-icon>
			<span>正在加载预览…</span>
		</div>

		<!-- Markdown 渲染 -->
		<div
v-else-if="fileType === 'md' || fileType === 'txt'" class="doc-preview__markdown"
			v-html="sanitize(renderedMarkdown)" />

		<!-- Word / PDF 渲染 HTML（后端提取后传入） -->
		<div v-else-if="fileType === 'docx' || fileType === 'pdf'" class="doc-preview__document">
			<div v-if="htmlContent" v-html="sanitize(htmlContent)" />
			<div v-else class="doc-preview__placeholder">
				<el-icon :size="48" color="var(--df-subtext)">
					<Document />
				</el-icon>
				<p>{{ fileType === 'pdf' ? 'PDF' : 'Word' }} 文档预览</p>
				<p class="doc-preview__placeholder-sub">
					文档内容将在接入存储后自动渲染
				</p>
			</div>
		</div>

		<!-- Excel 表格渲染 -->
		<div v-else-if="fileType === 'xlsx'" class="doc-preview__excel">
			<div v-if="excelSheets && excelSheets.length > 0">
				<div class="doc-preview__sheet-tabs">
					<button
v-for="(sheet, idx) in excelSheets" :key="idx" class="doc-preview__sheet-tab"
						:class="{ active: activeSheet === idx }" @click="activeSheet = idx">
						{{ sheet.name }}
					</button>
				</div>
				<div class="doc-preview__sheet-body" v-html="sanitize(excelSheets?.[activeSheet]?.html)" />
			</div>
			<div v-else class="doc-preview__placeholder">
				<el-icon :size="48" color="var(--df-subtext)">
					<Grid />
				</el-icon>
				<p>Excel 电子表格预览</p>
				<p class="doc-preview__placeholder-sub">
					文档内容将在接入存储后自动渲染
				</p>
			</div>
		</div>

		<!-- 不支持的格式 -->
		<div v-else class="doc-preview__placeholder">
			<el-icon :size="48" color="var(--df-subtext)">
				<Warning />
			</el-icon>
			<p>暂不支持预览此格式</p>
			<p class="doc-preview__placeholder-sub">
				支持的格式：Markdown、Word、PDF、Excel
			</p>
		</div>
	</div>
</template>

<script setup lang="ts">
import { Loading, Document, Grid, Warning } from '@element-plus/icons-vue'
import MarkdownIt from 'markdown-it'

const md = new MarkdownIt({
	html: false,
	linkify: true,
	typographer: true,
})

interface ExcelSheet {
	name: string
	html: string
}

const props = defineProps<{
	fileType: string
	/** 原始文本内容（Markdown / 纯文本） */
	content?: string
	/** 服务端渲染的 HTML（Word / PDF） */
	htmlContent?: string
	/** Excel 工作表数据 */
	excelSheets?: ExcelSheet[]
	loading?: boolean
}>()

const activeSheet = ref(0)

const renderedMarkdown = computed(() => {
	if (!props.content) return ''
	return md.render(props.content)
})

// 切换文件时重置 sheet 索引
watch(
	() => props.fileType,
	() => {
		activeSheet.value = 0
	}
)
</script>
