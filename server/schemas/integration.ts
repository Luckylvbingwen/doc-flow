import { z } from 'zod'

/* ── POST /api/integrations/feishu/notify ── */
export const feishuNotifySchema = z.object({
	openId: z.string().min(1, '缺少 openId 参数'),
	msgType: z.enum(['text', 'card']).default('text'),
	text: z.string().optional(),
	card: z.record(z.string(), z.any()).optional(),
}).refine(
	(data) => {
		if (data.msgType === 'text') return !!data.text
		if (data.msgType === 'card') return !!data.card
		return true
	},
	{ message: '文本消息需要 text 参数，卡片消息需要 card 参数' },
)
export type FeishuNotifyBody = z.infer<typeof feishuNotifySchema>

/* ── GET /api/integrations/feishu/users (query) ── */
export const feishuUsersQuerySchema = z.object({
	status: z.string().optional().default('normal'),
	keyword: z.string().optional().default(''),
})
export type FeishuUsersQuery = z.infer<typeof feishuUsersQuerySchema>
