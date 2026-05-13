<template>
	<div class="doc-preview" :class="`doc-preview--${fileType}`">
		<!-- 加载态 -->
		<div v-if="loading" class="doc-preview__loading">
			<el-icon class="is-loading" :size="28" color="var(--df-primary)">
				<Loading />
			</el-icon>
			<span>正在加载预览…</span>
		</div>

		<!-- Markdown 渲染：优先服务端预渲染 HTML（html prop），否则客户端 markdown-it (content prop) -->
		<div
v-else-if="fileType === 'md' || fileType === 'txt'" class="doc-preview__markdown"
			v-html="sanitize(renderedMarkdown)" />

		<!-- 服务端已渲染 HTML（不限文件类型） -->
		<div v-else-if="html" class="doc-preview__markdown" v-html="sanitize(html)" />

		<!-- Word / PDF 渲染 HTML（后端提取后传入） -->
		<div v-else-if="fileType === 'docx' || fileType === 'pdf'" class="doc-preview__document">
			<!-- PDF canvas 逐页渲染（需传入 url prop） -->
			<template v-if="fileType === 'pdf' && url">
				<div v-if="pdfRendering" class="doc-preview__loading">
					<el-icon class="is-loading" :size="28" color="var(--df-primary)">
						<Loading />
					</el-icon>
					<span>正在渲染 PDF…</span>
				</div>
				<div v-else ref="pdfContainerRef" class="doc-preview__pdf-canvas">
					<div class="doc-preview__pdf-nav">
						<el-button text size="small" :disabled="pdfCurrentPage <= 1" @click="pdfCurrentPage--">
							<el-icon :size="14">
								<ArrowLeft />
							</el-icon>
						</el-button>
						<span class="doc-preview__pdf-pageinfo">第 {{ pdfCurrentPage }} 页，共 {{ pdfPageCount }} 页</span>
						<el-button text size="small" :disabled="pdfCurrentPage >= pdfPageCount" @click="pdfCurrentPage++">
							<el-icon :size="14">
								<ArrowRight />
							</el-icon>
						</el-button>
					</div>
					<img
v-if="pdfCanvases[pdfCurrentPage - 1]" :src="pdfCanvases[pdfCurrentPage - 1]"
						class="doc-preview__pdf-page" alt="PDF 页面" >
				</div>
			</template>
			<!-- 降级：服务端预渲染 HTML -->
			<template v-else>
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
			</template>
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
import { Loading, Document, Grid, Warning, ArrowLeft, ArrowRight } from '@element-plus/icons-vue'
import MarkdownIt from 'markdown-it'
import * as pdfjsLib from 'pdfjs-dist'
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`

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
	/** 原始文本内容（Markdown / 纯文本，客户端用 markdown-it 渲染） */
	content?: string
	/** 服务端预渲染的 HTML（推荐路径，所有 MD 来源都走 /api/documents/:id/preview） */
	html?: string
	/** 服务端渲染的 HTML（Word / PDF — 与 html 同义，保留向后兼容） */
	htmlContent?: string
	/** Excel 工作表数据 */
	excelSheets?: ExcelSheet[]
	loading?: boolean
	/** PDF 直链（提供后启用 canvas 逐页渲染，否则降级到 htmlContent） */
	url?: string
}>()

const activeSheet = ref(0)

// ── PDF canvas 渲染 ──
const pdfContainerRef = ref<HTMLElement | null>(null)
const pdfCanvases = ref<string[]>([])
const pdfPageCount = ref(0)
const pdfCurrentPage = ref(1)
const pdfRendering = ref(false)

async function loadPdf(url: string) {
	pdfRendering.value = true
	pdfCanvases.value = []
	pdfCurrentPage.value = 1
	try {
		const pdfDoc = await pdfjsLib.getDocument(url).promise
		pdfPageCount.value = pdfDoc.numPages
		for (let i = 1; i <= pdfDoc.numPages; i++) {
			const page = await pdfDoc.getPage(i)
			const containerWidth = pdfContainerRef.value?.clientWidth || 800
			const viewport = page.getViewport({ scale: 1 })
			const scale = containerWidth / viewport.width
			const scaledVp = page.getViewport({ scale })
			const canvas = document.createElement('canvas')
			canvas.width = scaledVp.width
			canvas.height = scaledVp.height
			await page.render({ canvas, canvasContext: canvas.getContext('2d')!, viewport: scaledVp }).promise
			pdfCanvases.value.push(canvas.toDataURL())
		}
	} finally {
		pdfRendering.value = false
	}
}

watch(
	() => [props.fileType, props.url] as const,
	([type, url]) => {
		if (type === 'pdf' && url) {
			loadPdf(url)
		} else {
			pdfCanvases.value = []
			pdfPageCount.value = 0
		}
	},
	{ immediate: true },
)

/** MD/TXT 优先服务端预渲染 HTML（props.html），fallback 客户端 markdown-it */
const renderedMarkdown = computed(() => {
	if (props.html) return props.html
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
