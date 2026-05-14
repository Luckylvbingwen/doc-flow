/**
 * POST /api/integrations/feishu/webhook/employee
 * 飞书人事事件 Webhook — 接收员工离职事件，自动触发文档交接
 *
 * 飞书事件回调流程：
 *   1. 首次配置时飞书发送 url_verification 验证请求，需原样返回 challenge
 *   2. 后续推送事件（schema=2.0），header.event_type 标识事件类型
 *   3. 本接口处理 contact.user.updated_v3（用户状态变更，含离职）
 *
 * 鉴权：在 auth.ts 白名单中豁免（飞书服务器调用，不携带 JWT）
 * 安全：通过 verification_token 验证请求合法性
 */
import { prisma } from '~/server/utils/prisma'
import { deactivateUser } from '~/server/utils/user-deactivation'

const logger = useLogger('feishu-webhook')

export default defineEventHandler(async (event) => {
	const body = await readBody(event)

	// ── 1. URL 验证（首次配置回调地址时） ──
	if (body?.type === 'url_verification') {
		const config = useRuntimeConfig()
		const expectedToken = String(config.feishuVerificationToken || '')
		if (expectedToken && body.token !== expectedToken) {
			logger.warn('url_verification token 不匹配')
			setResponseStatus(event, 403)
			return { error: 'invalid token' }
		}
		return { challenge: body.challenge }
	}

	// ── 2. 事件回调（schema 2.0） ──
	if (body?.schema !== '2.0' || !body?.header) {
		return { code: 0, msg: 'ignored: not a v2 event' }
	}

	// 验证 token
	const config = useRuntimeConfig()
	const expectedToken = String(config.feishuVerificationToken || '')
	if (expectedToken && body.header.token !== expectedToken) {
		logger.warn({ eventId: body.header.event_id }, 'event token 不匹配')
		setResponseStatus(event, 403)
		return { error: 'invalid token' }
	}

	const eventType: string = body.header.event_type ?? ''
	const eventId: string = body.header.event_id ?? ''

	// 幂等：通过 event_id 去重（简单用内存 Set，生产环境可用 Redis）
	if (processedEventIds.has(eventId)) {
		return { code: 0, msg: 'duplicate event ignored' }
	}
	processedEventIds.add(eventId)
	// 防止内存膨胀，仅保留最近 1000 个
	if (processedEventIds.size > 1000) {
		const firstId = processedEventIds.values().next().value
		if (firstId) processedEventIds.delete(firstId)
	}

	// ── 3. 处理用户状态变更事件 ──
	if (eventType === 'contact.user.updated_v3') {
		return await handleUserUpdated(body.event)
	}

	logger.info({ eventType, eventId }, '未处理的事件类型')
	return { code: 0, msg: `event type '${eventType}' not handled` }
})

/** 已处理的事件 ID（简单去重） */
const processedEventIds = new Set<string>()

/**
 * 处理用户更新事件 — 检测离职状态变化
 */
async function handleUserUpdated(eventData: Record<string, unknown>): Promise<Record<string, unknown>> {
	const userObj = eventData?.object as Record<string, unknown> | undefined
	if (!userObj) {
		return { code: 0, msg: 'no user object' }
	}

	// 检查用户状态：is_resigned=true 表示已离职
	const status = userObj.status as Record<string, unknown> | undefined
	if (!status?.is_resigned) {
		return { code: 0, msg: 'user not resigned, skipping' }
	}

	// 获取飞书用户标识
	const openId = (userObj.open_id as string) || ''
	const feishuUserId = (userObj.user_id as string) || ''
	const userName = (userObj.name as string) || ''

	if (!openId && !feishuUserId) {
		logger.warn('离职事件中缺少 open_id 和 user_id')
		return { code: 0, msg: 'no user identifier' }
	}

	// 查找 DocFlow 用户
	const docUser = await prisma.doc_users.findFirst({
		where: openId
			? { feishu_open_id: openId, deleted_at: null }
			: { feishu_union_id: feishuUserId, deleted_at: null },
		select: { id: true, name: true, status: true },
	})

	if (!docUser) {
		logger.info({ openId, feishuUserId, userName }, '飞书离职用户在 DocFlow 中不存在，跳过')
		return { code: 0, msg: 'user not found in DocFlow' }
	}

	if (docUser.status === 0) {
		logger.info({ userId: Number(docUser.id), userName: docUser.name }, '用户已停用，跳过')
		return { code: 0, msg: 'user already deactivated' }
	}

	// 执行停用
	logger.info({ userId: Number(docUser.id), userName: docUser.name }, '飞书离职事件触发自动停用')
	const result = await deactivateUser({
		userId: Number(docUser.id),
		operatorId: 0,
		operatorName: '飞书人事系统',
		source: 'feishu_webhook',
	})

	logger.info({ userId: Number(docUser.id), result }, '自动停用完成')
	return { code: 0, msg: result.message }
}
