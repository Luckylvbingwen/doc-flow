/**
 * POST /api/groups/:id/feishu-import
 * 从飞书文档链接导入为 Markdown 文档
 *
 * 流程：
 *   1. 解析 URL 提取飞书 doc token
 *   2. 调飞书 API 获取文档标题 + 正文（raw_content）
 *   3. 以 UTF-8 Buffer 写入 MinIO
 *   4. executeUpload(mode='first') 完成事务落库 + 审批路由 + 通知日志
 *
 * 鉴权：需有组上传权限（canUpload）
 */
import crypto from 'node:crypto'
import { prisma } from '~/server/utils/prisma'
import { feishuGet, getFeishuTenantToken } from '~/server/utils/feishu'
import { storage, buildStorageKey } from '~/server/utils/storage'
import { generateId } from '~/server/utils/snowflake'
import { executeUpload } from '~/server/utils/document-upload'
import { feishuImportSchema } from '~/server/schemas/group'
import {
	INVALID_PARAMS,
	GROUP_NOT_FOUND,
	FEISHU_NOT_CONFIGURED,
} from '~/server/constants/error-codes'

/** 从飞书文档 URL 提取 doc token（docx/docs 两种格式） */
function parseFeishuDocToken(url: string): string | null {
	try {
		const u = new URL(url)
		const parts = u.pathname.split('/').filter(Boolean)
		const typeIdx = parts.findIndex(p => p === 'docx' || p === 'docs' || p === 'doc' || p === 'wiki')
		if (typeIdx === -1 || typeIdx + 1 >= parts.length) return null
		return parts[typeIdx + 1] || null
	} catch {
		return null
	}
}

interface FeishuDocMeta {
	document: {
		document_id: string
		title: string
	}
}

interface FeishuRawContent {
	content: string
	revision: number
}

export default defineEventHandler(async (event) => {
	const permErr = await requirePermission(event, 'doc:create')
	if (permErr) return permErr

	const groupIdParam = getRouterParam(event, 'id')
	const groupId = Number(groupIdParam)
	if (!Number.isFinite(groupId) || groupId <= 0) {
		return fail(event, 400, INVALID_PARAMS, '无效的组 ID')
	}

	const body = await readValidatedBody(event, feishuImportSchema.parse)

	// ── 组存在性校验 ──
	const group = await prisma.doc_groups.findFirst({
		where: { id: BigInt(groupId), deleted_at: null },
		select: { id: true },
	})
	if (!group) return fail(event, 404, GROUP_NOT_FOUND, '组不存在')

	// ── 解析飞书 doc token ──
	const docToken = parseFeishuDocToken(body.feishuUrl)
	if (!docToken) {
		return fail(event, 400, INVALID_PARAMS, '无法解析飞书文档链接，请确认链接格式正确')
	}

	// ── 飞书 API 调用 ──
	try {
		await getFeishuTenantToken() // 提前验证配置，失败会抛出
	} catch {
		return fail(event, 500, FEISHU_NOT_CONFIGURED, '飞书未配置，请联系管理员')
	}

	let title: string
	let content: string

	try {
		const metaRes = await feishuGet<{ code: number; data: FeishuDocMeta }>(
			`/open-apis/docx/v1/documents/${docToken}`,
		)
		if (metaRes.code !== 0) {
			return fail(event, 400, INVALID_PARAMS, '无法访问该飞书文档，请检查权限或链接是否正确')
		}
		title = metaRes.data.document.title || '飞书导入文档'

		const contentRes = await feishuGet<{ code: number; data: FeishuRawContent }>(
			`/open-apis/docx/v1/documents/${docToken}/raw_content`,
		)
		if (contentRes.code !== 0) {
			return fail(event, 400, INVALID_PARAMS, '获取飞书文档内容失败，请稍后重试')
		}
		content = contentRes.data.content || ''
	} catch (e) {
		const msg = e instanceof Error ? e.message : '飞书 API 调用失败'
		return fail(event, 502, INVALID_PARAMS, `飞书 API 调用失败，请稍后重试：${msg}`)
	}

	// ── 同名校验 ──
	const existing = await prisma.doc_documents.findFirst({
		where: {
			group_id: BigInt(groupId),
			title,
			deleted_at: null,
		},
		select: { id: true },
	})
	if (existing) {
		title = `${title}（飞书导入 ${new Date().toISOString().slice(0, 10)}）`
	}

	// ── 写入 MinIO ──
	const buffer = Buffer.from(content, 'utf-8')
	const checksum = crypto.createHash('sha256').update(buffer).digest('hex')
	const documentId = generateId()
	const versionId = generateId()
	const versionNo = 'v1.0'
	const ext = 'md'
	const mimeType = 'text/markdown; charset=utf-8'

	const storageKey = buildStorageKey({
		groupId,
		documentId,
		versionNo,
		checksum,
		ext,
	})

	await storage.putObject(storageKey, buffer, { mimeType, checksum })

	// ── 落库 + 审批路由 ──
	const user = event.context.user!
	const result = await executeUpload({
		mode: 'first',
		submitterId: Number(user.id),
		submitterName: user.name,
		groupId,
		documentId,
		versionId,
		title,
		ext,
		versionNo,
		changeNote: body.changeNote ?? `飞书文档导入：${body.feishuUrl}`,
		storageKey,
		storageBucket: storage.bucket,
		fileSize: buffer.byteLength,
		mimeType,
		checksum,
	})

	return ok(result, '文档已导入并自动转为 Markdown，正在进入审批流程')
})
