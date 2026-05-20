/**
 * 通知写入工具
 *
 * ═══════════════════════════════════════════════════════════════
 * 通知开发纪律（所有业务模块触发通知时必读）：
 *   1. 统一走 createNotification(NOTIFICATION_TEMPLATES.Mx.build(...))
 *      不要绕过模板直接 INSERT doc_notifications
 *   2. 新增业务行为 → 对照 PRD §6.8.2 定位 M 码 → 用
 *      server/constants/notification-templates.ts 查模板
 *   3. M1-M24 的归属模块和触发点进度见 docs/feature-gap-checklist.md
 *      「通知触发点接入清单」章节，完成后打 ✅ 并写完成日期
 *   4. 新增 biz_type 时同步更新 types/notification.ts + 前端
 *      utils/notification-meta.ts 的 resolveRoute 映射
 *   5. createNotification 内部会推送一条 WS 'badge' 消息更新该用户的
 *      notifications 未读数；批量请用 createNotifications 单次事务+按
 *      用户分组推送，避免 N 次 COUNT + N 次推送
 *   6. createNotification / createNotifications 已同步推送飞书交互卡片
 *      （PRD §6.8.3），无需在业务 API 中单独调用 feishuSendCard
 * ═══════════════════════════════════════════════════════════════
 */
import { prisma } from '~/server/utils/prisma'
import { generateId } from '~/server/utils/snowflake'
import { wsSendToUser } from '~/server/utils/ws'
import { feishuSendCard, feishuUpdateCard } from '~/server/utils/feishu'
import type { WsServerMessage } from '~/types/ws'
import type { CreateNotificationOpts, NotificationCategory, NotificationBizType } from '~/server/types/notification'

// ================================================================
//  飞书推送 — 内部辅助
// ================================================================

const logger = useLogger('notify-feishu')

/** 通知分类 → 飞书卡片 header 模板色 */
const CATEGORY_CARD_TEMPLATE: Record<number, string> = {
	1: 'blue',    // 审批
	2: 'orange',  // 系统
	3: 'green',   // 成员变更
}

/** 通知分类 → 中文标签 */
const CATEGORY_LABEL: Record<number, string> = {
	1: '审批通知',
	2: '系统通知',
	3: '成员变更',
}

/**
 * 构建飞书交互卡片
 * @see https://open.feishu.cn/document/ukTMukTMukTM/uczM3QjL3MzN04yNzcDN
 */
function buildFeishuCard(opts: CreateNotificationOpts): Record<string, unknown> {
	const config = useRuntimeConfig()
	const siteUrl = (config.public?.feishuSiteUrl as string) || 'http://localhost:3000'

	const headerTemplate = CATEGORY_CARD_TEMPLATE[opts.category] || 'blue'
	const categoryLabel = CATEGORY_LABEL[opts.category] || '通知'

	const elements: Record<string, unknown>[] = [
		{
			tag: 'div',
			text: {
				tag: 'lark_md',
				content: `**${opts.title}**`,
			},
		},
	]

	// 结构化正文（PRD 要求：操作人+所属组+操作时间+操作描述）
	if (opts.content) {
		elements.push({
			tag: 'div',
			text: {
				tag: 'lark_md',
				content: opts.content,
			},
		})
	}

	// 操作时间
	elements.push({
		tag: 'div',
		text: {
			tag: 'lark_md',
			content: `🕐 ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`,
		},
	})

	elements.push({ tag: 'hr' })

	// 按消息类型区分操作按钮
	const APPROVE_CODES = ['M10', 'M12', 'M14', 'M15']
	const REVOKE_CODES = ['M6']
	const actions: Record<string, unknown>[] = []

	if (APPROVE_CODES.includes(opts.msgCode)) {
		actions.push(
			{ tag: 'button', text: { tag: 'plain_text', content: '同意' }, type: 'primary', url: `${siteUrl}/notifications` },
			{ tag: 'button', text: { tag: 'plain_text', content: '拒绝' }, type: 'danger', url: `${siteUrl}/notifications` },
		)
	} else if (REVOKE_CODES.includes(opts.msgCode)) {
		actions.push(
			{ tag: 'button', text: { tag: 'plain_text', content: '撤回' }, type: 'default', url: `${siteUrl}/notifications` },
			{ tag: 'button', text: { tag: 'plain_text', content: '查看' }, type: 'primary', url: `${siteUrl}/notifications` },
		)
	} else {
		actions.push(
			{ tag: 'button', text: { tag: 'plain_text', content: '查看详情' }, type: 'primary', url: `${siteUrl}/notifications` },
		)
	}

	elements.push({ tag: 'action', actions })

	return {
		config: { wide_screen_mode: true },
		header: {
			title: { tag: 'plain_text', content: `[DocFlow] ${categoryLabel}` },
			template: headerTemplate,
		},
		elements,
	}
}

function buildFeishuResultCard(opts: { title: string; content?: string | null; category: NotificationCategory; resultLabel: string }): Record<string, unknown> {
	const headerTemplate = CATEGORY_CARD_TEMPLATE[opts.category] || 'blue'
	const categoryLabel = CATEGORY_LABEL[opts.category] || '通知'
	const elements: Record<string, unknown>[] = [
		{
			tag: 'div',
			text: {
				tag: 'lark_md',
				content: `**${opts.title}**`,
			},
		},
	]

	if (opts.content) {
		elements.push({
			tag: 'div',
			text: {
				tag: 'lark_md',
				content: opts.content,
			},
		})
	}

	elements.push(
		{ tag: 'hr' },
		{
			tag: 'div',
			text: {
				tag: 'lark_md',
				content: `**处理结果：${opts.resultLabel}**`,
			},
		},
	)

	return {
		config: { wide_screen_mode: true },
		header: {
			title: { tag: 'plain_text', content: `[DocFlow] ${categoryLabel}` },
			template: headerTemplate,
		},
		elements,
	}
}

/**
 * 批量查询用户 feishu_open_id
 * @returns Map<userId(string), feishu_open_id>
 */
async function batchGetFeishuOpenIds(userIds: bigint[]): Promise<Map<string, string>> {
	if (userIds.length === 0) return new Map()

	const rows = await prisma.doc_users.findMany({
		where: { id: { in: userIds }, feishu_open_id: { not: '' } },
		select: { id: true, feishu_open_id: true },
	})

	const map = new Map<string, string>()
	for (const r of rows) {
		if (r.feishu_open_id) {
			map.set(String(r.id), r.feishu_open_id)
		}
	}
	return map
}

/**
 * 推送飞书卡片给单个用户（fire-and-forget，不阻塞站内通知）
 */
async function pushFeishuCard(notificationId: bigint, openId: string, opts: CreateNotificationOpts): Promise<void> {
	try {
		const card = buildFeishuCard(opts)
		const res = await feishuSendCard(openId, card)
		if (res.message_id || res.open_message_id) {
			await prisma.doc_notifications.update({
				where: { id: notificationId },
				data: {
					feishu_message_id: res.message_id ?? null,
					feishu_open_message_id: res.open_message_id ?? null,
				},
			})
		}
	} catch (err) {
		// 飞书推送失败不应影响站内通知，仅记录日志
		logger.warn({ err, userId: String(opts.userId), msgCode: opts.msgCode }, '飞书通知推送失败')
	}
}

export async function updateLatestFeishuCardResultByBiz(opts: {
	userId: bigint | number
	msgCode: string
	bizType: NotificationBizType
	bizId: bigint | number
	resultLabel: string
}): Promise<void> {
	const row = await prisma.doc_notifications.findFirst({
		where: {
			user_id: BigInt(opts.userId),
			msg_code: opts.msgCode,
			biz_type: opts.bizType,
			biz_id: BigInt(opts.bizId),
			feishu_message_id: { not: null },
		},
		orderBy: { created_at: 'desc' },
		select: {
			id: true,
			category: true,
			title: true,
			content: true,
			feishu_message_id: true,
		},
	})

	if (!row?.feishu_message_id) return

	try {
		await feishuUpdateCard(row.feishu_message_id, buildFeishuResultCard({
			title: row.title,
			content: row.content,
			category: row.category as NotificationCategory,
			resultLabel: opts.resultLabel,
		}))
	} catch (err) {
		logger.warn({ err, notificationId: String(row.id), msgCode: opts.msgCode }, '飞书通知卡片更新失败')
	}
}

// ================================================================
//  站内通知 + 飞书推送
// ================================================================

/** 创建一条通知并推送 WS 'badge' 消息 + 飞书卡片 */
export async function createNotification(opts: CreateNotificationOpts): Promise<void> {
	const userIdBI = BigInt(opts.userId)
	const notificationId = generateId()

	await prisma.doc_notifications.create({
		data: {
			id: notificationId,
			user_id: userIdBI,
			category: opts.category,
			msg_code: opts.msgCode,
			title: opts.title,
			content: opts.content ?? null,
			biz_type: opts.bizType ?? null,
			biz_id: opts.bizId !== undefined ? BigInt(opts.bizId) : null,
		},
	})

	await pushBadgeToUser(userIdBI)

	// 飞书推送（异步，不阻塞主流程）
	const openIdMap = await batchGetFeishuOpenIds([userIdBI])
	const openId = openIdMap.get(String(userIdBI))
	if (openId) {
		pushFeishuCard(notificationId, openId, opts).catch(() => { })
	}
}

/**
 * 批量创建通知：单次批量插入，按 userId 分组只推送一次 badge + 飞书卡片
 * 适用于"组内所有成员""所有审批人"等多目标场景
 */
export async function createNotifications(list: CreateNotificationOpts[]): Promise<void> {
	if (list.length === 0) return

	const rows = list.map(opts => ({
		id: generateId(),
		user_id: BigInt(opts.userId),
		category: opts.category,
		msg_code: opts.msgCode,
		title: opts.title,
		content: opts.content ?? null,
		biz_type: opts.bizType ?? null,
		biz_id: opts.bizId !== undefined ? BigInt(opts.bizId) : null,
	}))

	await prisma.doc_notifications.createMany({ data: rows })

	const uniqueUserIds = Array.from(new Set(rows.map(r => r.user_id)))
	await Promise.all(uniqueUserIds.map(uid => pushBadgeToUser(uid)))

	// 飞书推送（异步，不阻塞主流程）
	const openIdMap = await batchGetFeishuOpenIds(uniqueUserIds)
	const feishuTasks: Promise<void>[] = []
	for (const [index, opts] of list.entries()) {
		const row = rows[index]
		const openId = openIdMap.get(String(BigInt(opts.userId)))
		if (openId) {
			feishuTasks.push(pushFeishuCard(row.id, openId, opts))
		}
	}
	if (feishuTasks.length > 0) {
		Promise.allSettled(feishuTasks).catch(() => { })
	}
}

/**
 * 查询某用户未读数并通过 WebSocket 推送 'badge' 消息
 * 导出供读端 handler（已读 / 全部已读）在写操作后复用，避免重复 count+推送逻辑
 */
export async function pushBadgeToUser(userId: bigint): Promise<void> {
	const unreadCount = await prisma.doc_notifications.count({
		where: { user_id: userId, read_at: null },
	})

	const msg: WsServerMessage = {
		type: 'badge',
		payload: { notifications: unreadCount },
	}
	// wsSendToUser 同步写入在线 peer 的 socket，不返回 Promise，无需 await
	wsSendToUser(Number(userId), msg)
}
