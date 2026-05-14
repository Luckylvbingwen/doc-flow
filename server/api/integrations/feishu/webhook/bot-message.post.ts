/**
 * POST /api/integrations/feishu/webhook/bot-message
 * 飞书机器人消息 Webhook — 接收消息中的飞书文档链接，自动归档到 DocFlow
 *
 * 流程：
 *   1. 解析消息内容中的飞书文档链接
 *   2. 调飞书 API 获取文档标题 + raw_content
 *   3. 以 UTF-8 写入 MinIO
 *   4. 创建 DocFlow 草稿文档（个人中心，不归组不审批）
 *   5. 通过 Bot 回复用户：「文档已归档到个人中心」
 *
 * 鉴权：免登（飞书服务器调用），通过 verification_token 校验
 */
import crypto from 'node:crypto'
import { prisma } from '~/server/utils/prisma'
import { feishuGet, getFeishuTenantToken, feishuSendMessage } from '~/server/utils/feishu'
import { storage, buildStorageKey } from '~/server/utils/storage'
import { generateId } from '~/server/utils/snowflake'

const logger = useLogger('feishu-bot')

/** 从飞书文档 URL 提取 doc token */
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

/** 从文本中提取飞书文档 URL */
function extractFeishuDocUrls(text: string): string[] {
	const urlRegex = /https?:\/\/[^\s"'<>]*feishu\.cn[^\s"'<>]*/gi
	const matches = text.match(urlRegex) || []
	return matches.filter(url => parseFeishuDocToken(url) !== null)
}

/** 已处理的事件 ID（简单去重） */
const processedEventIds = new Set<string>()

export default defineEventHandler(async (event) => {
	const body = await readBody(event)

	// ── 1. URL 验证 ──
	if (body?.type === 'url_verification') {
		const config = useRuntimeConfig()
		const expectedToken = String(config.feishuVerificationToken || '')
		if (expectedToken && body.token !== expectedToken) {
			setResponseStatus(event, 403)
			return { error: 'invalid token' }
		}
		return { challenge: body.challenge }
	}

	// ── 2. 事件回调 ──
	if (body?.schema !== '2.0' || !body?.header) {
		return { code: 0, msg: 'ignored' }
	}

	const config = useRuntimeConfig()
	const expectedToken = String(config.feishuVerificationToken || '')
	if (expectedToken && body.header.token !== expectedToken) {
		setResponseStatus(event, 403)
		return { error: 'invalid token' }
	}

	const eventType: string = body.header.event_type ?? ''
	const eventId: string = body.header.event_id ?? ''

	// 幂等去重
	if (processedEventIds.has(eventId)) {
		return { code: 0, msg: 'duplicate' }
	}
	processedEventIds.add(eventId)
	if (processedEventIds.size > 1000) {
		const firstId = processedEventIds.values().next().value
		if (firstId) processedEventIds.delete(firstId)
	}

	// 仅处理消息接收事件
	if (eventType !== 'im.message.receive_v1') {
		return { code: 0, msg: `event '${eventType}' not handled` }
	}

	// 异步处理，快速响应飞书（飞书要求 3 秒内响应）
	handleBotMessage(body.event).catch(err => {
		logger.error({ err }, '处理 Bot 消息失败')
	})

	return { code: 0, msg: 'ok' }
})

interface FeishuDocMeta {
	document: { document_id: string; title: string }
}

interface FeishuRawContent {
	content: string
	revision: number
}

async function handleBotMessage(eventData: Record<string, unknown>): Promise<void> {
	const message = eventData?.message as Record<string, unknown> | undefined
	const sender = eventData?.sender as Record<string, unknown> | undefined
	if (!message || !sender) return

	const msgType = message.message_type as string
	const chatId = message.chat_id as string

	// 仅处理文本消息
	if (msgType !== 'text') {
		if (chatId) {
			await safeReply(chatId, '目前仅支持发送包含飞书文档链接的文本消息')
		}
		return
	}

	// 解析消息内容
	let textContent = ''
	try {
		const contentStr = message.content as string
		const parsed = JSON.parse(contentStr)
		textContent = parsed?.text || ''
	} catch {
		return
	}

	// 提取飞书文档 URL
	const docUrls = extractFeishuDocUrls(textContent)
	if (docUrls.length === 0) {
		await safeReply(chatId, '未在消息中找到飞书文档链接。请发送包含飞书文档链接的消息。')
		return
	}

	// 查找发送者的 DocFlow 用户
	const senderInfo = sender.sender_id as Record<string, string> | undefined
	const senderOpenId = senderInfo?.open_id || ''
	if (!senderOpenId) {
		await safeReply(chatId, '无法识别您的身份，请确认已绑定飞书账号')
		return
	}

	const docUser = await prisma.doc_users.findFirst({
		where: { feishu_open_id: senderOpenId, status: 1, deleted_at: null },
		select: { id: true, name: true },
	})
	if (!docUser) {
		await safeReply(chatId, '您的飞书账号尚未在 DocFlow 中激活，请先登录 DocFlow')
		return
	}

	// 处理每个文档链接
	const results: string[] = []
	for (const url of docUrls) {
		try {
			const result = await importFeishuDoc(url, Number(docUser.id))
			results.push(`✅ 《${result.title}》已归档到个人中心`)
		} catch (err) {
			const msg = err instanceof Error ? err.message : '未知错误'
			logger.warn({ err, url }, '飞书文档归档失败')
			results.push(`❌ 文档归档失败：${msg}`)
		}
	}

	const siteUrl = (config().public?.feishuSiteUrl as string) || 'http://localhost:3000'
	const replyText = results.join('\n') + `\n\n请前往 DocFlow 个人中心查看：${siteUrl}/profile`
	await safeReply(chatId, replyText)
}

function config() {
	return useRuntimeConfig()
}

/**
 * 导入飞书文档为个人草稿
 */
async function importFeishuDoc(
	feishuUrl: string,
	userId: number,
): Promise<{ title: string; documentId: string }> {
	const docToken = parseFeishuDocToken(feishuUrl)
	if (!docToken) throw new Error('无法解析飞书文档链接')

	await getFeishuTenantToken()

	// 获取文档标题
	const metaRes = await feishuGet<FeishuDocMeta>(
		`/open-apis/docx/v1/documents/${docToken}`,
	)
	const title = metaRes?.document?.title || '飞书导入文档'

	// 获取文档内容
	const contentRes = await feishuGet<FeishuRawContent>(
		`/open-apis/docx/v1/documents/${docToken}/raw_content`,
	)
	const content = contentRes?.content || ''

	// 写入 MinIO
	const buffer = Buffer.from(content, 'utf-8')
	const checksum = crypto.createHash('sha256').update(buffer).digest('hex')
	const documentId = generateId()
	const versionId = generateId()
	const versionNo = 'v1.0'
	const ext = 'md'
	const mimeType = 'text/markdown; charset=utf-8'

	const storageKey = buildStorageKey({
		groupId: 0,
		documentId,
		versionNo,
		checksum,
		ext,
	})

	await storage.putObject(storageKey, buffer, { mimeType, checksum })

	// 创建个人草稿文档（不归组、不走审批）
	const now = new Date()
	await prisma.$transaction(async (tx) => {
		await tx.doc_documents.create({
			data: {
				id: documentId,
				title: title,
				ext,
				status: 1, // 草稿
				group_id: null,
				owner_user_id: BigInt(userId),
				created_by: BigInt(userId),
				updated_by: BigInt(userId),
				created_at: now,
				updated_at: now,
			},
		})
		await tx.doc_document_versions.create({
			data: {
				id: versionId,
				document_id: documentId,
				version_no: versionNo,
				storage_key: storageKey,
				storage_bucket: storage.bucket,
				file_size: buffer.byteLength,
				mime_type: mimeType,
				checksum,
				change_note: `飞书 Bot 归档：${feishuUrl}`,
				uploaded_by: BigInt(userId),
				created_at: now,
			},
		})
	})

	logger.info({ documentId: Number(documentId), title, userId }, '飞书 Bot 文档归档成功')

	return { title, documentId: String(documentId) }
}

/** 安全回复到聊天，失败仅记录日志 */
async function safeReply(chatId: string, text: string): Promise<void> {
	try {
		await feishuSendMessage(chatId, 'text', JSON.stringify({ text }), 'chat_id')
	} catch (err) {
		logger.warn({ err, chatId }, '飞书 Bot 回复失败')
	}
}
