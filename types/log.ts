/**
 * 操作日志前端类型
 */
import type { LogTypeCode } from '~/utils/log-types'

export interface LogItem {
	/** 日志 ID */
	id: number
	/** 14 大类 */
	type: LogTypeCode
	/** 具体 action 字符串，如 'doc.upload' */
	action: string
	/** 操作人姓名；系统事件为「系统」 */
	actorName: string
	/** 操作人 ID；系统事件为 0 */
	actorId: number
	/** 操作描述（服务端格式化后的完整文案） */
	description: string
	/** 所属组名；无关联组显示 '-' */
	groupName: string
	/** 操作时间（毫秒时间戳，前端用 formatTime 渲染） */
	createdAt: number
}
