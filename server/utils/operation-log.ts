/**
 * 操作日志埋点 helper（§6.7）
 *
 * 埋点纪律（摘自 constants/log-actions.ts 头注释）：
 *   1. 一个业务事件一条日志
 *   2. 系统自动触发时 actor_user_id=0，detail_json.triggeredBy / sourceLogId 做溯源
 *   3. detail_json.desc 必填，作为预渲染描述供列表直接展示
 */
import type { Prisma } from '@prisma/client'
import { prisma } from '~/server/utils/prisma'
import { generateId } from '~/server/utils/snowflake'
import type { LogActionCode } from '~/server/constants/log-actions'

export interface LogEntry {
	/** 操作人 id；系统自动触发传 0 */
	actorUserId: number
	/** action 码，使用 LOG_ACTIONS 常量 */
	action: LogActionCode
	/** 目标类型：document / group / approval / user 等 */
	targetType: string
	/** 目标 id，可空 */
	targetId?: number | null
	/** 关联组 id */
	groupId?: number | null
	/** 关联文档 id */
	documentId?: number | null
	/** 详情 json；至少包含 desc 字段作为描述 */
	detail: { desc: string } & Record<string, unknown>
}

/** 单条写入 */
export async function writeLog(entry: LogEntry): Promise<void> {
	await prisma.doc_operation_logs.create({
		data: {
			id: generateId(),
			actor_user_id: BigInt(entry.actorUserId),
			action: entry.action,
			target_type: entry.targetType,
			target_id: entry.targetId != null ? BigInt(entry.targetId) : null,
			group_id: entry.groupId != null ? BigInt(entry.groupId) : null,
			document_id: entry.documentId != null ? BigInt(entry.documentId) : null,
			detail_json: entry.detail as Prisma.InputJsonValue,
		},
	})
}

/** 批量写入（用 createMany，无 detail 序列化差异场景） */
export async function writeLogs(entries: LogEntry[]): Promise<void> {
	if (entries.length === 0) return
	await prisma.doc_operation_logs.createMany({
		data: entries.map(e => ({
			id: generateId(),
			actor_user_id: BigInt(e.actorUserId),
			action: e.action,
			target_type: e.targetType,
			target_id: e.targetId != null ? BigInt(e.targetId) : null,
			group_id: e.groupId != null ? BigInt(e.groupId) : null,
			document_id: e.documentId != null ? BigInt(e.documentId) : null,
			detail_json: e.detail as Prisma.InputJsonValue,
		})),
	})
}
