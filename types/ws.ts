/**
 * WebSocket 消息类型定义
 */

/** 服务端 → 客户端：badge 更新 */
export interface WsBadgePayload {
	/** 通知未读数 */
	notifications?: number
	/** 待审批数 */
	approvals?: number
}

/** 服务端 → 客户端：批注同步事件 */
export interface WsAnnotationReply {
	id: string
	content: string
	authorName: string
	authorAvatar: string | null
	createdAt: number
}

export interface WsAnnotationItem {
	id: string
	content: string
	quoteText: string
	anchorData: Record<string, unknown>
	authorName: string
	authorAvatar: string | null
	createdAt: number
	status: number
	resolvedAt: number | null
	frozen: boolean
	replies: WsAnnotationReply[]
}

export interface WsAnnotationSyncPayload {
	/** 文档 ID */
	documentId: number
	/** 动作类型 */
	action: 'created' | 'updated' | 'deleted' | 'replied'
	/** 批注 ID（回复/更新/删除时存在） */
	annotationId?: string
	/** 批注详情（created/updated 时存在） */
	annotation?: WsAnnotationItem
	/** 回复详情（replied 时存在） */
	reply?: WsAnnotationReply
	/** 操作人 ID */
	actorUserId?: number
	/** 事件时间戳（毫秒） */
	timestamp: number
}

/** 服务端 → 客户端消息 */
export interface WsServerMessage {
	type: 'badge' | 'connected' | 'annotation-sync'
	payload?: WsBadgePayload | WsAnnotationSyncPayload | Record<string, unknown>
}

/** 客户端 → 服务端消息 */
export type WsClientMessage =
	| { type: 'ping' }
	| { type: 'subscribe-document'; payload: { documentId: number } }
	| { type: 'unsubscribe-document'; payload: { documentId: number } }
