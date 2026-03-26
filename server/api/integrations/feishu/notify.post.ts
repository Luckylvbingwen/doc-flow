/**
 * POST /api/integrations/feishu/notify
 * 发送飞书消息给指定用户
 *
 * Body:
 *   - openId: string       接收者飞书 open_id
 *   - msgType: 'text' | 'card'  消息类型
 *   - text?: string         文本消息内容（msgType=text 时必填）
 *   - card?: object         卡片结构体（msgType=card 时必填）
 */

interface NotifyBody {
	openId?: string
	msgType?: 'text' | 'card'
	text?: string
	card?: Record<string, unknown>
}

export default defineEventHandler(async (event) => {
	const body = await readBody<NotifyBody>(event)
	const openId = body.openId?.trim() || ''
	const msgType = body.msgType || 'text'

	if (!openId) {
		return fail(event, 400, 'PARAM_MISSING', '缺少 openId 参数')
	}

	try {
		if (msgType === 'card') {
			if (!body.card) {
				return fail(event, 400, 'PARAM_MISSING', '卡片消息缺少 card 参数')
			}
			await feishuSendCard(openId, body.card)
		} else {
			if (!body.text) {
				return fail(event, 400, 'PARAM_MISSING', '文本消息缺少 text 参数')
			}
			await feishuSendText(openId, body.text)
		}

		return ok({ sent: true }, '飞书消息发送成功')
	} catch (error) {
		console.error('feishu.notify failed:', error)
		const msg = error instanceof Error ? error.message : '飞书消息发送失败'
		return fail(event, 500, 'FEISHU_SEND_ERROR', msg)
	}
})
