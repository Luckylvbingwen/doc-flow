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
import { feishuNotifySchema } from '~/server/schemas/integration'
import { FEISHU_SEND_ERROR } from '~/server/constants/error-codes'

export default defineEventHandler(async (event) => {
	const body = await readValidatedBody(event, feishuNotifySchema.parse)
	const openId = body.openId.trim()
	const msgType = body.msgType

	try {
		if (msgType === 'card') {
			await feishuSendCard(openId, body.card!)
		} else {
			await feishuSendText(openId, body.text!)
		}

		return ok({ sent: true }, '飞书消息发送成功')
	} catch (error) {
		const logger = useLogger('feishu')
		logger.error({ err: error }, 'feishu.notify failed')
		const msg = error instanceof Error ? error.message : '飞书消息发送失败'
		return fail(event, 500, FEISHU_SEND_ERROR, msg)
	}
})
