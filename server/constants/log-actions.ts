/**
 * 操作日志 action 常量
 *
 * 命名纪律:
 *   - 代码标识符: UPPER_SNAKE（与 error-codes.ts 风格一致）
 *   - DB 存储值:  module.verb 点分小写（事件命名惯例，便于 action LIKE 'approval.%' 前缀聚合）
 *
 * 埋点纪律:
 *   - 一事件一日志：系统自动触发的副作用也单独成条，actor_user_id = 0（系统）
 *   - 因果溯源：副作用日志的 detail_json 附 { triggeredBy, sourceLogId } 指向父事件
 *   - 示例：审批通过最后一节点 → 同时写两条：
 *           approval.pass（actor=审批人）+ doc.publish（actor=0，detail.triggeredBy='approval.pass'）
 *
 * 新增 action 步骤:
 *   1) 在下方 LOG_ACTIONS 中添加常量
 *   2) 在 LOG_ACTION_TO_TYPE 里将其归入对应 14 类
 *   3) 若引入了新的 14 类（一般不会），同步 LOG_TYPES 与前端 utils/log-types.ts
 */

/** action 码常量 — 代码中使用 LOG_ACTIONS.DOC_UPLOAD，DB 存储其值 'doc.upload' */
export const LOG_ACTIONS = {
	// ── 文件上传 ──
	DOC_UPLOAD: 'doc.upload',
	DOC_UPLOAD_VERSION: 'doc.upload_version',
	DOC_IMPORT_FEISHU: 'doc.import_feishu',

	DOC_ROLLBACK: 'doc.rollback',

	// ── 文件编辑 ──
	DOC_DRAFT_CREATE: 'doc.draft_create',
	DOC_EDIT_SAVE: 'doc.edit_save',
	DOC_SNAPSHOT_CREATE: 'doc.snapshot_create',

	// ── 文件下载 ──
	DOC_DOWNLOAD: 'doc.download',

	// ── 审批操作 ──
	APPROVAL_SUBMIT: 'approval.submit',
	APPROVAL_PASS: 'approval.pass',
	APPROVAL_REJECT: 'approval.reject',
	APPROVAL_WITHDRAW: 'approval.withdraw',
	APPROVAL_REMIND: 'approval.remind',
	APPROVAL_REMIND_LIMIT: 'approval.remind_limit',

	// ── 文件发布 ──
	DOC_PUBLISH: 'doc.publish',

	// ── 文件移动 ──
	DOC_MOVE_REQUEST: 'doc.move.request',
	DOC_MOVE_APPROVE: 'doc.move.approve',
	DOC_MOVE_REJECT: 'doc.move.reject',
	DOC_MOVE_EXPIRE: 'doc.move.expire',
	DOC_MOVE: 'doc.move',

	// ── 文件移除 ──
	DOC_REMOVE: 'doc.remove',
	DOC_DRAFT_DELETE: 'doc.draft_delete',
	RECYCLE_RESTORE: 'recycle.restore',
	RECYCLE_PURGE: 'recycle.purge',
	RECYCLE_AUTO_PURGE: 'recycle.auto_purge',

	// ── 权限变更 ──
	PERMISSION_GROUP_UPDATE: 'permission.group_update',
	PERMISSION_DOC_UPDATE: 'permission.doc_update',
	PERMISSION_REQ_APPROVE: 'permission.request_approve',
	PERMISSION_REQ_REJECT: 'permission.request_reject',

	// ── 分享 ──
	SHARE_CREATE: 'share.create',
	SHARE_REQUEST_EDIT: 'share.request_edit',

	// ── 成员变更 ──
	MEMBER_ADD: 'member.add',
	MEMBER_REMOVE: 'member.remove',
	MEMBER_FEISHU_SYNC: 'member.feishu_sync',

	// ── 归属人变更 ──
	OWNERSHIP_REQUEST: 'ownership.request',
	OWNERSHIP_APPROVE: 'ownership.approve',
	OWNERSHIP_REJECT: 'ownership.reject',
	OWNERSHIP_EXPIRE: 'ownership.expire',
	OWNERSHIP_HANDOVER: 'ownership.handover',

	// ── 评论批注 ──
	COMMENT_ADD: 'comment.add',
	COMMENT_REPLY: 'comment.reply',
	COMMENT_DELETE: 'comment.delete',
	ANNOTATION_ADD: 'annotation.add',
	ANNOTATION_REPLY: 'annotation.reply',
	ANNOTATION_RESOLVE: 'annotation.resolve',

	// ── 组织管理 ──
	GROUP_CREATE: 'group.create',
	GROUP_UPDATE: 'group.update',
	GROUP_DELETE: 'group.delete',
	DEPT_CREATE: 'dept.create',
	DEPT_UPDATE: 'dept.update',
	DEPT_DELETE: 'dept.delete',
	PL_CREATE: 'pl.create',
	PL_UPDATE: 'pl.update',
	PL_DELETE: 'pl.delete',

	// ── 收藏置顶 ──
	FAVORITE_ADD: 'favorite.add',
	FAVORITE_REMOVE: 'favorite.remove',
	PIN_ADD: 'pin.add',
	PIN_REMOVE: 'pin.remove',

	// ── 系统管理（§6.9） ──
	ADMIN_ROLE_ASSIGN: 'admin.role_assign',
} as const

/** 具体 action 字符串的联合类型 */
export type LogActionCode = typeof LOG_ACTIONS[keyof typeof LOG_ACTIONS]

/** PRD §6.7.2 — 14 大类（筛选 + 展示） */
export const LOG_TYPES = [
	'file_upload',
	'file_edit',
	'file_download',
	'approval',
	'file_publish',
	'file_move',
	'file_remove',
	'permission',
	'share',
	'member',
	'ownership',
	'comment',
	'org',
	'favorite_pin',
] as const

export type LogTypeCode = typeof LOG_TYPES[number]

/**
 * action → 14 类 的聚合映射
 * 前端下拉筛选时传 LogTypeCode，后端据此展开为 WHERE action IN (...)
 */
export const LOG_ACTION_TO_TYPE: Record<LogActionCode, LogTypeCode> = {
	[LOG_ACTIONS.DOC_UPLOAD]: 'file_upload',
	[LOG_ACTIONS.DOC_UPLOAD_VERSION]: 'file_upload',
	[LOG_ACTIONS.DOC_IMPORT_FEISHU]: 'file_upload',

	[LOG_ACTIONS.DOC_DRAFT_CREATE]: 'file_edit',
	[LOG_ACTIONS.DOC_EDIT_SAVE]: 'file_edit',
	[LOG_ACTIONS.DOC_SNAPSHOT_CREATE]: 'file_edit',

	[LOG_ACTIONS.DOC_DOWNLOAD]: 'file_download',

	[LOG_ACTIONS.APPROVAL_SUBMIT]: 'approval',
	[LOG_ACTIONS.APPROVAL_PASS]: 'approval',
	[LOG_ACTIONS.APPROVAL_REJECT]: 'approval',
	[LOG_ACTIONS.APPROVAL_WITHDRAW]: 'approval',
	[LOG_ACTIONS.APPROVAL_REMIND]: 'approval',
	[LOG_ACTIONS.APPROVAL_REMIND_LIMIT]: 'approval',

	[LOG_ACTIONS.DOC_PUBLISH]: 'file_publish',
	[LOG_ACTIONS.DOC_ROLLBACK]: 'file_publish',

	[LOG_ACTIONS.DOC_MOVE_REQUEST]: 'file_move',
	[LOG_ACTIONS.DOC_MOVE_APPROVE]: 'file_move',
	[LOG_ACTIONS.DOC_MOVE_REJECT]: 'file_move',
	[LOG_ACTIONS.DOC_MOVE_EXPIRE]: 'file_move',
	[LOG_ACTIONS.DOC_MOVE]: 'file_move',

	[LOG_ACTIONS.DOC_REMOVE]: 'file_remove',
	[LOG_ACTIONS.DOC_DRAFT_DELETE]: 'file_remove',
	[LOG_ACTIONS.RECYCLE_RESTORE]: 'file_remove',
	[LOG_ACTIONS.RECYCLE_PURGE]: 'file_remove',
	[LOG_ACTIONS.RECYCLE_AUTO_PURGE]: 'file_remove',

	[LOG_ACTIONS.PERMISSION_GROUP_UPDATE]: 'permission',
	[LOG_ACTIONS.PERMISSION_DOC_UPDATE]: 'permission',
	[LOG_ACTIONS.PERMISSION_REQ_APPROVE]: 'permission',
	[LOG_ACTIONS.PERMISSION_REQ_REJECT]: 'permission',

	[LOG_ACTIONS.SHARE_CREATE]: 'share',
	[LOG_ACTIONS.SHARE_REQUEST_EDIT]: 'share',

	[LOG_ACTIONS.MEMBER_ADD]: 'member',
	[LOG_ACTIONS.MEMBER_REMOVE]: 'member',
	[LOG_ACTIONS.MEMBER_FEISHU_SYNC]: 'member',

	[LOG_ACTIONS.OWNERSHIP_REQUEST]: 'ownership',
	[LOG_ACTIONS.OWNERSHIP_APPROVE]: 'ownership',
	[LOG_ACTIONS.OWNERSHIP_REJECT]: 'ownership',
	[LOG_ACTIONS.OWNERSHIP_EXPIRE]: 'ownership',
	[LOG_ACTIONS.OWNERSHIP_HANDOVER]: 'ownership',

	[LOG_ACTIONS.COMMENT_ADD]: 'comment',
	[LOG_ACTIONS.COMMENT_REPLY]: 'comment',
	[LOG_ACTIONS.COMMENT_DELETE]: 'comment',
	[LOG_ACTIONS.ANNOTATION_ADD]: 'comment',
	[LOG_ACTIONS.ANNOTATION_REPLY]: 'comment',
	[LOG_ACTIONS.ANNOTATION_RESOLVE]: 'comment',

	[LOG_ACTIONS.GROUP_CREATE]: 'org',
	[LOG_ACTIONS.GROUP_UPDATE]: 'org',
	[LOG_ACTIONS.GROUP_DELETE]: 'org',
	[LOG_ACTIONS.DEPT_CREATE]: 'org',
	[LOG_ACTIONS.DEPT_UPDATE]: 'org',
	[LOG_ACTIONS.DEPT_DELETE]: 'org',
	[LOG_ACTIONS.PL_CREATE]: 'org',
	[LOG_ACTIONS.PL_UPDATE]: 'org',
	[LOG_ACTIONS.PL_DELETE]: 'org',

	[LOG_ACTIONS.FAVORITE_ADD]: 'favorite_pin',
	[LOG_ACTIONS.FAVORITE_REMOVE]: 'favorite_pin',
	[LOG_ACTIONS.PIN_ADD]: 'favorite_pin',
	[LOG_ACTIONS.PIN_REMOVE]: 'favorite_pin',

	// 系统管理：指派公司层管理员 / 产品线负责人 — 归入"权限变更"类别
	[LOG_ACTIONS.ADMIN_ROLE_ASSIGN]: 'permission',
}

/** 14 类 → 该类包含的所有 action 码（反向索引，用于 WHERE IN 展开） */
export const LOG_TYPE_TO_ACTIONS: Record<LogTypeCode, LogActionCode[]> = (() => {
	const map = Object.fromEntries(LOG_TYPES.map(t => [t, [] as LogActionCode[]])) as Record<LogTypeCode, LogActionCode[]>
	for (const [action, type] of Object.entries(LOG_ACTION_TO_TYPE)) {
		map[type as LogTypeCode].push(action as LogActionCode)
	}
	return map
})()
