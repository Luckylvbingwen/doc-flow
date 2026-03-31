import { versionCompareSchema } from '~/server/schemas/version'
import { computeLineDiff, mergeAdjacentDiffs, buildDiffSummary, renderDiffHtml } from '~/server/utils/diff'
import { isSupportedFormat } from '~/server/utils/extract'
import type { CompareResult } from '~/types/version'

/**
 * POST /api/version/compare
 * 版本对比接口：接收两个版本 ID，返回差异对比结果
 *
 * 未来接入存储后流程：
 * 1. 从 DB 查版本记录 → 获取 storage_key + ext
 * 2. 从对象存储下载两个版本文件 Buffer
 * 3. extractText(buffer, ext) 提取文本
 * 4. computeLineDiff → mergeAdjacentDiffs → buildDiffSummary → renderDiffHtml
 */
export default defineEventHandler(async (event) => {
	const body = await readValidatedBody(event, versionCompareSchema.parse)

	// TODO: 接入真实存储
	// const [fromVer, toVer] = await Promise.all([
	//   prisma.doc_document_versions.findUnique({ where: { id: body.fromVersionId } }),
	//   prisma.doc_document_versions.findUnique({ where: { id: body.toVersionId } }),
	// ])
	// if (!fromVer || !toVer) return fail(event, 404, 'NOT_FOUND', '版本不存在')
	// const ext = fromVer.mime_type?.split('/').pop() || 'txt'
	// if (!isSupportedFormat(ext)) return fail(event, 400, 'UNSUPPORTED_FORMAT', `不支持的文件格式: ${ext}`)
	// const [fromBuf, toBuf] = await Promise.all([
	//   storage.getObject(fromVer.storage_bucket, fromVer.storage_key),
	//   storage.getObject(toVer.storage_bucket, toVer.storage_key),
	// ])
	// const [newText, oldText] = await Promise.all([
	//   extractText(fromBuf, ext),
	//   extractText(toBuf, ext),
	// ])

	// Mock 阶段 — 使用内置示例内容
	const mockData = getMockContent(body.documentId)
	const fileType = mockData.fileType

	// 执行 diff 计算
	const rawChunks = computeLineDiff(mockData.oldText, mockData.newText)
	const chunks = mergeAdjacentDiffs(rawChunks)
	const summary = buildDiffSummary(chunks, mockData.oldSize, mockData.newSize)
	const { newHtml, oldHtml } = renderDiffHtml(chunks, fileType)

	const result: CompareResult = {
		documentId: body.documentId,
		fileName: mockData.fileName,
		fileType,
		newVersion: {
			versionId: body.fromVersionId,
			versionNo: mockData.newVersionNo,
			html: newHtml,
		},
		oldVersion: {
			versionId: body.toVersionId,
			versionNo: mockData.oldVersionNo,
			html: oldHtml,
		},
		summary,
		chunks,
	}

	return ok(result)
})

/** Mock 内容生成（开发阶段使用，接入存储后移除） */
function getMockContent(_documentId: number) {
	return {
		fileName: '数据库优化方案.docx',
		fileType: 'docx',
		newVersionNo: 'v1.0',
		oldVersionNo: 'v0.5',
		newSize: 1_126_400,
		oldSize: 921_600,
		newText: [
			'数据库优化方案',
			'',
			'一、项目背景',
			'随着企业协同办公市场的快速发展，主流协同办公平台在文档管理、即时通讯、项目管理等领域不断迭代升级。',
			'',
			'二、竞品概览',
			'| 产品 | 核心定位 | 用户规模 |',
			'| 飞书 | 一站式协作 | 500万+ |',
			'| 钉钉 | 数字化工作 | 6亿+ |',
			'',
			'三、优化方案',
			'根据评审反馈，补充了详细的实施方案。针对文档协作场景，建议从实时协作能力、版本管理机制和审批流程集成三个维度进行优化。',
			'',
			'四、实施时间表',
			'第一阶段（3月）：完成基础架构搭建；第二阶段（4月）：核心功能开发；第三阶段（5月）：灰度测试与优化。',
			'',
			'五、现有内容',
			'更新了数据指标和预期目标。当前文档管理功能覆盖率已达到 85%，预计 Q2 可达 95%。',
		].join('\n'),
		oldText: [
			'数据库优化方案',
			'',
			'一、项目背景',
			'主流协同办公平台在文档管理、即时通讯、项目管理等领域不断迭代升级。',
			'',
			'二、竞品概览',
			'| 产品 | 核心定位 | 用户规模 |',
			'| 飞书 | 一站式协作 | 500万+ |',
			'| 钉钉 | 数字化工作 | 6亿+ |',
			'',
			'三、待补充章节',
			'（此章节内容待补充）',
			'',
			'四、现有内容',
			'数据指标待确认。当前文档管理功能覆盖率已达到 85%，预计 Q2 可达 95%。',
		].join('\n'),
	}
}
