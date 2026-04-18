/** 通知分类 */
export type NotificationCategory = 1 | 2 | 3

/** biz_type 允许值（A 阶段） */
export type NotificationBizType = 'document' | 'group' | 'group_approval'

/** DB 行（Prisma 模型方法返回） */
export interface NotificationRow {
	id: bigint
	user_id: bigint
	category: number
	msg_code: string | null
	title: string
	content: string | null
	biz_type: string | null
	biz_id: bigint | null
	read_at: Date | null
	created_at: Date
}

/** 前端展示条目（毫秒时间戳 + string ID） */
export interface NotificationItem {
	id: string
	category: NotificationCategory
	msgCode: string | null
	title: string
	content: string | null
	bizType: NotificationBizType | null
	bizId: string | null
	read: boolean
	readAt: number | null
	createdAt: number
}

/** 分页响应 */
export interface NotificationListResp {
	list: NotificationItem[]
	total: number
	page: number
	pageSize: number
}

/** 未读计数响应 */
export interface UnreadCountResp {
	total: number
	byCategory: { '1': number, '2': number, '3': number }
}

/** createNotification 入参（helper + 模板表共同依赖） */
export interface CreateNotificationOpts {
	userId: bigint | number
	category: NotificationCategory
	msgCode: string
	title: string
	content?: string
	bizType?: NotificationBizType
	bizId?: bigint | number
}
