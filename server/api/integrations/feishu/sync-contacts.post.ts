/**
 * POST /api/integrations/feishu/sync-contacts
 * 同步飞书组织架构通讯录到 doc_feishu_users 表
 *
 * 核心逻辑已提取到 server/utils/feishu.ts → feishuSyncContacts()
 * 同时由 server/tasks/feishu/sync-contacts.ts 定时任务复用
 */
import { FEISHU_SYNC_ERROR } from '~/server/constants/error-codes'
import { writeLog } from '~/server/utils/operation-log'
import { LOG_ACTIONS } from '~/server/constants/log-actions'

export default defineEventHandler(async (event) => {
	try {
		const result = await feishuSyncContacts()

		if (result.total === 0) {
			return ok(result, '未获取到飞书用户')
		}

		const user = event.context.user
		await writeLog({
			actorUserId: user?.id ?? 0,
			action: LOG_ACTIONS.MEMBER_FEISHU_SYNC,
			targetType: 'system',
			targetId: 0,
			detail: { desc: `飞书通讯录同步完成，共 ${result.total} 人`, ...result },
		})

		return ok(result, '飞书通讯录同步完成')
	} catch (error) {
		const logger = useLogger('feishu')
		logger.error({ err: error }, 'feishu sync-contacts failed')
		const msg = error instanceof Error ? error.message : '飞书通讯录同步失败'
		return fail(event, 500, FEISHU_SYNC_ERROR, msg)
	}
})
