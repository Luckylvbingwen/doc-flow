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

/** 服务端 → 客户端消息 */
export interface WsServerMessage {
	type: 'badge' | 'connected'
	payload?: WsBadgePayload | Record<string, unknown>
}

/** 客户端 → 服务端消息 */
export interface WsClientMessage {
	type: 'ping'
}
