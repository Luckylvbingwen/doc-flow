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
		console.log('[task] feishu:sync-contacts 开始执行...')
		try {
			const result = await feishuSyncContacts()
			console.log(`[task] feishu:sync-contacts 完成: ${result.total} 用户, ${result.departments} 部门, 新增 ${result.created}, 更新 ${result.updated}, 隐藏 ${result.hidden}`)
			return { result }
		} catch (error) {
			console.error('[task] feishu:sync-contacts 失败:', error)
			return { result: undefined }
		}
	},
})
