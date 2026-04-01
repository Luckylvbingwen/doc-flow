/**
 * Nitro 定时任务: feishu:sync-contacts
 * 每天凌晨 2:00 自动同步飞书通讯录到 doc_feishu_users
 */
export default defineTask({
	meta: {
		name: 'feishu:sync-contacts',
		description: '同步飞书组织架构通讯录',
	},
	async run() {
		const logger = useLogger('task:feishu-sync')
		logger.info('feishu:sync-contacts 开始执行')
		try {
			const result = await feishuSyncContacts()
			logger.info({ result }, 'feishu:sync-contacts 完成')
			return { result }
		} catch (error) {
			logger.error({ err: error }, 'feishu:sync-contacts 失败')
			return { result: undefined }
		}
	},
})
