/** 飞书文本消息 */
export interface FeishuTextPayload {
	msg_type: 'text'
	content: {
		text: string
	}
}

/** 飞书交互卡片消息 */
export interface FeishuCardPayload {
	msg_type: 'interactive'
	content: {
		config?: { wide_screen_mode?: boolean }
		header?: {
			title: { tag: string; content: string }
			template?: string
		}
		elements: Array<Record<string, unknown>>
	}
}

/** 飞书通知请求体 */
export interface FeishuNotifyRequest {
	openId: string
	msgType: 'text' | 'card'
	text?: string
	card?: Record<string, unknown>
}

/** 飞书 OAuth 用户信息 */
export interface FeishuOAuthUser {
	openId: string
	unionId: string
	userId: string
	name: string
	avatarUrl: string
	email: string
	mobile: string
}
