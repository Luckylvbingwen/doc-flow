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
 * ═══════════════════════════════════════════════════════════════
 */
import { prisma } from '~/server/utils/prisma'
import { generateId } from '~/server/utils/snowflake'
import { wsSendToUser } from '~/server/utils/ws'
import type { WsServerMessage } from '~/types/ws'
import type { CreateNotificationOpts } from '~/server/types/notification'

/** 创建一条通知并推送 WS 'badge' 消息 */
export async function createNotification(opts: CreateNotificationOpts): Promise<void> {
	const userIdBI = BigInt(opts.userId)

	await prisma.doc_notifications.create({
		data: {
			id: generateId(),
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
}

/**
 * 批量创建通知：单次批量插入，按 userId 分组只推送一次 badge
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
